"""
Generate synthetic loan portfolio dataset (5,000 rows) for DataTalk demo.
Run: python -m app.synthetic_data.generate_loans
Output: backend/sample_data/loan_portfolio.csv
"""
import random
import math
from datetime import date, timedelta
import pandas as pd
import numpy as np
import os

random.seed(42)
np.random.seed(42)

FIRST_NAMES = ["Aarav","Priya","Rahul","Sneha","Vikram","Ananya","Rajesh","Kavya","Amit","Pooja",
               "Sanjay","Meera","Deepak","Nisha","Arjun","Sunita","Rohan","Divya","Arun","Lakshmi",
               "Suresh","Geeta","Manoj","Rekha","Vinod","Usha","Ramesh","Sushma","Ajay","Smita",
               "Kiran","Radha","Mohan","Asha","Naveen","Seema","Harish","Bindu","Girish","Padma"]
LAST_NAMES  = ["Sharma","Verma","Patel","Singh","Kumar","Gupta","Joshi","Rao","Mehta","Nair",
               "Reddy","Iyer","Pillai","Bose","Das","Sinha","Mishra","Tiwari","Pandey","Shah"]
BRANCHES    = ["Mumbai Main","Delhi Central","Bangalore Tech","Chennai Port","Hyderabad Jubilee",
               "Pune FC Road","Ahmedabad CG","Kolkata Park","Jaipur MI","Lucknow Hazratganj"]
REGIONS     = {"Mumbai Main":"West","Delhi Central":"North","Bangalore Tech":"South",
               "Chennai Port":"South","Hyderabad Jubilee":"South","Pune FC Road":"West",
               "Ahmedabad CG":"West","Kolkata Park":"East","Jaipur MI":"North","Lucknow Hazratganj":"North"}

LOAN_TYPES  = ["Home","Personal","Vehicle","Education","Business","Agriculture","MSME"]
RATE_TYPES  = ["Fixed","Floating (EBLR)","Floating (MCLR)"]
SECTORS     = ["Housing","Other","Other","Other","Other","Agriculture","MSME","Education","Weaker Sections","Other"]
SECTOR_MAP  = {
    "Home":"Housing","Personal":"Other","Vehicle":"Other",
    "Education":"Education","Business":"Other","Agriculture":"Agriculture","MSME":"MSME"
}
ASSET_CLASSES = ["Standard","SMA-0","SMA-1","SMA-2","Substandard","Doubtful","Loss"]


def random_name():
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"


def dpd_to_classification(dpd: int, force_misclassify: bool = False) -> str:
    """Map days-past-due to RBI IRAC asset classification."""
    if force_misclassify:
        return "Standard"  # deliberate error for compliance demo
    if dpd == 0:
        return "Standard"
    elif dpd <= 30:
        return "SMA-0"
    elif dpd <= 60:
        return "SMA-1"
    elif dpd <= 90:
        return "SMA-2"
    elif dpd <= 180:
        return "Substandard"
    elif dpd <= 365:
        return "Doubtful"
    else:
        return "Loss"


def generate_loan(i: int, psl_budget_remaining: float, total_remaining: int) -> dict:
    loan_id = f"L{i:05d}"
    customer_name = random_name()
    branch = random.choice(BRANCHES)
    region = REGIONS[branch]

    loan_type = random.choice(LOAN_TYPES)
    sector = SECTOR_MAP[loan_type]

    # PSL targeting: keep PSL ratio ~37% (below 40% target for compliance demo)
    psl_sectors = {"Agriculture","MSME","Education","Housing","Weaker Sections"}
    if sector in psl_sectors and psl_budget_remaining / max(total_remaining, 1) < 0.37:
        pass  # allow PSL loan
    elif sector not in psl_sectors and psl_budget_remaining / max(total_remaining, 1) > 0.37:
        loan_type = random.choice(["Personal","Vehicle","Business"])
        sector = SECTOR_MAP[loan_type]

    # Principal amount by loan type
    principal_ranges = {
        "Home":       (500_000, 50_000_000),
        "Personal":   (50_000,  1_500_000),
        "Vehicle":    (100_000, 2_000_000),
        "Education":  (100_000, 2_500_000),
        "Business":   (500_000, 10_000_000),
        "Agriculture":(50_000,  1_000_000),
        "MSME":       (200_000, 5_000_000),
    }
    lo, hi = principal_ranges[loan_type]
    principal = round(random.uniform(lo, hi) / 1000) * 1000

    # Rate
    if loan_type in ("Home","Vehicle","Business","MSME"):
        rate_type = random.choices(RATE_TYPES, weights=[30,50,20])[0]
    else:
        rate_type = random.choices(RATE_TYPES, weights=[70,15,15])[0]

    if "EBLR" in rate_type:
        interest_rate = round(random.uniform(8.5, 9.5), 2)
    elif "MCLR" in rate_type:
        interest_rate = round(random.uniform(8.8, 10.5), 2)
    else:
        interest_rate = round(random.uniform(6.5, 18.0), 2)
        if loan_type == "Personal":
            interest_rate = round(random.uniform(11.0, 18.0), 2)
        elif loan_type == "Agriculture":
            interest_rate = round(random.uniform(7.0, 9.0), 2)

    # Tenure
    tenure_months_map = {
        "Home":240,"Personal":36,"Vehicle":60,"Education":84,
        "Business":84,"Agriculture":36,"MSME":60
    }
    tenure = tenure_months_map[loan_type] + random.randint(-12, 12)
    tenure = max(12, tenure)

    # Dates
    max_disb_days_ago = 365 * 5
    days_ago = random.randint(30, max_disb_days_ago)
    disbursement_date = date.today() - timedelta(days=days_ago)
    maturity_date = disbursement_date + timedelta(days=tenure * 30)

    # Outstanding balance
    months_elapsed = days_ago // 30
    monthly_rate = interest_rate / 100 / 12
    if monthly_rate > 0:
        emi = principal * monthly_rate * (1 + monthly_rate)**tenure / ((1 + monthly_rate)**tenure - 1)
    else:
        emi = principal / tenure
    emi = round(emi, 2)
    outstanding = principal * ((1 + monthly_rate)**tenure - (1 + monthly_rate)**months_elapsed) / ((1 + monthly_rate)**tenure - 1)
    outstanding = max(0, round(outstanding, 2))

    # Days past due — NPA distribution ~8%
    npa_roll = random.random()
    if npa_roll < 0.76:
        dpd = 0
    elif npa_roll < 0.82:
        dpd = random.randint(1, 30)     # SMA-0
    elif npa_roll < 0.87:
        dpd = random.randint(31, 60)    # SMA-1
    elif npa_roll < 0.91:
        dpd = random.randint(61, 90)    # SMA-2
    elif npa_roll < 0.95:
        dpd = random.randint(91, 180)   # Substandard
    elif npa_roll < 0.98:
        dpd = random.randint(181, 365)  # Doubtful
    else:
        dpd = random.randint(366, 730)  # Loss

    # Agriculture / MSME have higher default rates
    if loan_type in ("Agriculture","MSME") and dpd == 0 and random.random() < 0.05:
        dpd = random.randint(1, 90)

    # Deliberately misclassify ~23 SMA-2 loans as Standard (for compliance demo)
    force_mis = dpd > 60 and dpd <= 90 and random.random() < 0.35
    asset_classification = dpd_to_classification(dpd, force_misclassify=force_mis)

    # Last payment date
    if dpd == 0:
        last_payment_date = date.today() - timedelta(days=random.randint(1, 35))
    else:
        last_payment_date = date.today() - timedelta(days=dpd + random.randint(0, 10))

    # Customer financials
    income_mult = {"Home":6,"Personal":3,"Vehicle":4,"Education":1,"Business":8,"Agriculture":4,"MSME":5}
    min_income = max(200_000, principal // income_mult.get(loan_type, 5))
    customer_income = round(random.uniform(min_income, min_income * 4) / 10_000) * 10_000

    credit_score = int(np.clip(np.random.normal(700, 80), 300, 900))
    if dpd > 90:
        credit_score = int(np.clip(credit_score - random.randint(50, 150), 300, 900))

    collateral_value = 0.0
    if loan_type in ("Home","Vehicle","Business","MSME"):
        collateral_value = round(principal * random.uniform(1.1, 2.0) / 10_000) * 10_000

    return {
        "loan_id": loan_id,
        "customer_name": customer_name,
        "loan_type": loan_type,
        "disbursement_date": disbursement_date.isoformat(),
        "maturity_date": maturity_date.isoformat(),
        "principal_amount": principal,
        "interest_rate": interest_rate,
        "rate_type": rate_type,
        "outstanding_balance": outstanding,
        "emi_amount": emi,
        "last_payment_date": last_payment_date.isoformat(),
        "days_past_due": dpd,
        "asset_classification": asset_classification,
        "customer_income": customer_income,
        "credit_score": credit_score,
        "collateral_value": collateral_value,
        "sector": sector,
        "branch": branch,
        "region": region,
    }


def main():
    n = 5000
    rows = []
    psl_count = 0
    psl_sectors = {"Agriculture","MSME","Education","Housing","Weaker Sections"}
    for i in range(1, n + 1):
        row = generate_loan(i, psl_count, n - i + 1)
        if row["sector"] in psl_sectors:
            psl_count += 1
        rows.append(row)

    df = pd.DataFrame(rows)
    out_dir = os.path.join(os.path.dirname(__file__), "..", "..", "sample_data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "loan_portfolio.csv")
    df.to_csv(out_path, index=False)

    npa_count = len(df[df["asset_classification"].isin(["Substandard","Doubtful","Loss"])])
    psl_ratio = len(df[df["sector"].isin(psl_sectors)]) / len(df) * 100
    print(f"Generated {len(df)} loans -> {out_path}")
    print(f"  NPA count: {npa_count} ({npa_count/len(df)*100:.1f}%)")
    print(f"  PSL ratio: {psl_ratio:.1f}%  (target: 40%, we have ~37% for demo)")
    misclass = len(df[(df["days_past_due"] > 60) & (df["days_past_due"] <= 90) & (df["asset_classification"] == "Standard")])
    print(f"  Deliberate misclassifications (SMA-2 marked as Standard): {misclass}")


if __name__ == "__main__":
    main()
