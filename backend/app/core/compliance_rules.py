"""
Deterministic compliance rule engine — no LLM needed.
Rules based on RBI IRAC norms, PSL guidelines, PMLA thresholds, and DPDP Act.
"""
from typing import List, Dict, Any

# PII field name patterns (case-insensitive substring match)
PII_PATTERNS = [
    "aadhaar", "aadhar", "uid", "biometric", "fingerprint", "iris",
    "pan_number", "pan number", "passport", "voter_id", "voter id",
    "ssn", "social security", "dob", "date_of_birth", "date of birth",
    "password", "pin", "cvv", "credit_card", "debit_card",
]


def check_pii_query(question: str) -> Dict | None:
    """
    Pre-screen: block queries that try to expose PII.
    Returns a block dict if triggered, None if clean.
    """
    q = question.lower()
    for pattern in PII_PATTERNS:
        if pattern in q:
            return {
                "rule": "PII_EXPOSURE",
                "status": "blocked",
                "message": (
                    f"Query blocked: This analysis appears to request access to sensitive "
                    f"personal data ('{pattern}'). Per the DPDP Act 2023, PII including Aadhaar, "
                    f"PAN, biometrics, and financial credentials must be anonymised before analysis. "
                    f"Use the Sensitive Column toggle to mask this field first."
                ),
            }
    return None


def check_npa_classification(data: List[Dict], days_col: str = None, class_col: str = None) -> Dict | None:
    """
    Post-validate: check for loans marked Standard with DPD in SMA-2 range (61–90 days).
    Returns annotation dict or None if clean.
    """
    if not data:
        return None

    # Auto-detect columns
    if not days_col or not class_col:
        sample = data[0]
        keys = list(sample.keys())
        for k in keys:
            kl = k.lower()
            if days_col is None and any(x in kl for x in ["days_past", "dpd", "overdue", "past_due"]):
                days_col = k
            if class_col is None and any(x in kl for x in ["classification", "npa", "asset_class", "status"]):
                class_col = k

    if not days_col or not class_col:
        return None

    misclassified = []
    for row in data:
        try:
            dpd = int(row.get(days_col, 0) or 0)
            cls = str(row.get(class_col, "")).strip()
            if 61 <= dpd <= 90 and cls.lower() in ("standard", "regular"):
                misclassified.append(row)
        except (ValueError, TypeError):
            continue

    if not misclassified:
        return {
            "rule": "NPA_CLASSIFICATION",
            "status": "compliant",
            "message": "NPA classification verified. All accounts with DPD 61–90 days are correctly marked SMA-2 per RBI IRAC norms.",
        }

    count = len(misclassified)
    return {
        "rule": "NPA_CLASSIFICATION",
        "status": "warning",
        "message": (
            f"{count} loan(s) appear misclassified: they have DPD between 61–90 days but are "
            f"still marked 'Standard'. Per RBI IRAC norms, these should be classified as SMA-2. "
            f"Misclassification may lead to regulatory findings and provisioning shortfalls."
        ),
        "affected_count": count,
    }


def check_psl_ratio(data: List[Dict], sector_col: str = None, amount_col: str = None) -> Dict | None:
    """
    Post-validate: calculate PSL ratio and flag if below 40% RBI target.
    """
    if not data:
        return None

    PSL_SECTORS = {"agriculture", "msme", "education", "housing", "weaker sections", "priority sector"}

    if not sector_col or not amount_col:
        sample = data[0]
        keys = list(sample.keys())
        for k in keys:
            kl = k.lower()
            if sector_col is None and any(x in kl for x in ["sector", "category", "purpose", "segment"]):
                sector_col = k
            if amount_col is None and any(x in kl for x in ["amount", "principal", "outstanding", "balance", "loan_amount"]):
                amount_col = k

    if not sector_col or not amount_col:
        return None

    total_amt = 0.0
    psl_amt = 0.0
    for row in data:
        try:
            amt = float(row.get(amount_col, 0) or 0)
            sector = str(row.get(sector_col, "")).strip().lower()
            total_amt += amt
            if any(ps in sector for ps in PSL_SECTORS):
                psl_amt += amt
        except (ValueError, TypeError):
            continue

    if total_amt == 0:
        return None

    ratio = psl_amt / total_amt * 100
    target = 40.0
    shortfall_pct = target - ratio

    if ratio >= target:
        return {
            "rule": "PSL_RATIO",
            "status": "compliant",
            "message": f"PSL ratio is {ratio:.1f}%, meeting the RBI mandate of 40%. No shortfall.",
        }

    shortfall_amt = (target / 100 - psl_amt / total_amt) * total_amt
    return {
        "rule": "PSL_RATIO",
        "status": "warning",
        "message": (
            f"PSL ratio is {ratio:.1f}%, below the RBI mandate of 40%. "
            f"Shortfall: {shortfall_pct:.1f} percentage points "
            f"(approximately \u20b9{shortfall_amt/1e7:.1f} Cr). "
            f"Failure to meet PSL targets results in deposits in RIDF at below-market rates."
        ),
        "psl_ratio": round(ratio, 2),
        "target": target,
    }


def check_pmla_threshold(data: List[Dict], amount_col: str = None, mode_col: str = None) -> Dict | None:
    """
    Post-validate: flag cash transactions above Rs.10 lakh (CTR threshold).
    """
    if not data:
        return None

    THRESHOLD = 1_000_000  # Rs.10 lakh

    if not amount_col or not mode_col:
        sample = data[0]
        keys = list(sample.keys())
        for k in keys:
            kl = k.lower()
            if amount_col is None and any(x in kl for x in ["amount", "value", "txn_amount"]):
                amount_col = k
            if mode_col is None and any(x in kl for x in ["mode", "channel", "type", "method"]):
                mode_col = k

    if not amount_col:
        return None

    triggers = []
    for row in data:
        try:
            amt = float(row.get(amount_col, 0) or 0)
            mode = str(row.get(mode_col, "") or "").lower() if mode_col else ""
            if amt >= THRESHOLD and ("cash" in mode or mode == ""):
                triggers.append(row)
        except (ValueError, TypeError):
            continue

    if not triggers:
        return None

    count = len(triggers)
    return {
        "rule": "PMLA_CTR_THRESHOLD",
        "status": "warning",
        "message": (
            f"{count} transaction(s) meet the PMLA Cash Transaction Report (CTR) threshold "
            f"of \u20b910 lakh. Per PMLA 2002, CTRs must be filed with FIU-IND by the 15th of "
            f"the following month. Verify that CTRs have been submitted for these transactions."
        ),
        "affected_count": count,
    }


def run_all_applicable_rules(question: str, data: List[Dict]) -> List[Dict]:
    """
    Run all deterministic rules that are applicable based on question keywords and data.
    Returns list of annotation dicts.
    """
    annotations = []
    q = question.lower()

    # NPA / asset classification check
    if any(kw in q for kw in ["npa", "asset class", "classification", "overdue", "past due", "dpd", "sma", "standard"]):
        result = check_npa_classification(data)
        if result:
            annotations.append(result)

    # PSL check
    if any(kw in q for kw in ["psl", "priority sector", "agriculture", "msme", "education", "housing", "weaker"]):
        result = check_psl_ratio(data)
        if result:
            annotations.append(result)

    # PMLA / cash transaction check
    if any(kw in q for kw in ["cash", "transaction", "ctر", "pmla", "aml", "suspicious", "structuring", "10 lakh", "threshold"]):
        result = check_pmla_threshold(data)
        if result:
            annotations.append(result)

    return annotations
