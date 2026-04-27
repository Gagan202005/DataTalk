"""
Confidence Score Calculator — 5 weighted dimensions:
  row_coverage (25%), data_completeness (25%), schema_match (20%),
  web_corroboration (15%), compliance_check (15%)
"""


def calculate_confidence(
    rows_used: int = 0,
    total_rows: int = 0,
    columns_used: list[str] | None = None,
    schema: list[dict] | None = None,
    question: str = "",
    web_results: list[dict] | None = None,
    sql_error: str | None = None,
    compliance_status: str = "compliant",
) -> dict:
    if not columns_used:
        columns_used = []
    if not schema:
        schema = []

    if sql_error:
        return {
            "score": 20,
            "level": "Low",
            "breakdown": {
                "row_coverage": 0,
                "data_completeness": 0,
                "schema_match": 20,
                "web_corroboration": 0,
                "compliance_check": 0,
            },
        }

    # 1. Row Coverage (25%)
    row_score = min(1.0, rows_used / total_rows) * 100 if total_rows > 0 else 0

    # 2. Data Completeness (25%)
    if columns_used and schema:
        schema_map = {col["name"].lower(): col for col in schema}
        missing_pcts = [schema_map.get(c.lower(), {}).get("missing_pct", 0) for c in columns_used]
        completeness_score = max(0, 100 - sum(missing_pcts) / max(len(missing_pcts), 1))
    else:
        completeness_score = 50

    # 3. Schema Match (20%)
    if columns_used:
        known_columns = {col["name"].lower() for col in schema}
        matched = sum(1 for c in columns_used if c.lower() in known_columns)
        schema_score = (matched / max(len(columns_used), 1)) * 100
    else:
        question_lower = question.lower()
        matches = sum(1 for col in schema if col["name"].lower() in question_lower)
        schema_score = min(100, matches * 25) if matches else 30

    # 4. Web Corroboration (15%)
    web_score = min(100, len(web_results) * 25) if web_results else 0

    # 5. Compliance Check (15%)
    compliance_score = {"compliant": 100, "warning": 50, "blocked": 0}.get(compliance_status, 100)

    total = (
        row_score * 0.25
        + completeness_score * 0.25
        + schema_score * 0.20
        + web_score * 0.15
        + compliance_score * 0.15
    )

    level = "High" if total >= 75 else ("Medium" if total >= 50 else "Low")

    return {
        "score": round(total),
        "level": level,
        "breakdown": {
            "row_coverage": round(row_score),
            "data_completeness": round(completeness_score),
            "schema_match": round(schema_score),
            "web_corroboration": round(web_score),
            "compliance_check": round(compliance_score),
        },
    }
