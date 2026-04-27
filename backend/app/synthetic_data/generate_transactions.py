"""
Generate synthetic transaction ledger (50,000 rows) for DataTalk demo.
Run: python -m app.synthetic_data.generate_transactions
Output: backend/sample_data/transactions.csv
"""
import random
from datetime import date, timedelta
import pandas as pd
import numpy as np
import os

random.seed(43)
np.random.seed(43)

BRANCHES = ["Mumbai Main","Delhi Central","Bangalore Tech","Chennai Port","Hyderabad Jubilee",
            "Pune FC Road","Ahmedabad CG","Kolkata Park","Jaipur MI","Lucknow Hazratganj"]
TXN_MODES = ["UPI","NEFT","RTGS","Cash","Cheque","IMPS"]
PURPOSES  = ["Salary Credit","Vendor Payment","Rent","Loan EMI","Investment","Utility Bill",
             "Insurance Premium","Personal Transfer","Business Receipt","Tax Payment",
             "FD Interest","Dividend","Refund","Purchase","Medical Expense"]


def random_account():
    return f"ACC{random.randint(100000, 999999)}"


def random_name():
    first = random.choice(["Ravi","Suresh","Anita","Priya","Mohan","Geeta","Ajay","Sunita","Deepak","Pooja"])
    last  = random.choice(["Sharma","Patel","Singh","Kumar","Gupta","Joshi","Rao","Nair","Reddy","Iyer"])
    return f"{first} {last}"


def main():
    n = 50_000
    rows = []

    accounts = [random_account() for _ in range(2000)]
    for i in range(1, n - 19 + 1):
        acc = random.choice(accounts)
        branch = random.choice(BRANCHES)
        txn_date = date.today() - timedelta(days=random.randint(0, 365))
        txn_type = random.choice(["Credit","Debit"])
        mode = random.choices(TXN_MODES, weights=[35,25,10,10,10,10])[0]

        if mode == "RTGS":
            amount = round(random.uniform(200_000, 5_000_000), 2)
        elif mode == "Cash":
            amount = round(random.uniform(5_000, 800_000), 2)
        elif mode == "NEFT":
            amount = round(random.uniform(1_000, 500_000), 2)
        else:
            amount = round(random.uniform(100, 100_000), 2)

        rows.append({
            "txn_id": f"TXN{i:07d}",
            "account_number": acc,
            "txn_date": txn_date.isoformat(),
            "txn_type": txn_type,
            "txn_mode": mode,
            "amount": amount,
            "counterparty": random_name(),
            "branch": branch,
            "purpose": random.choice(PURPOSES),
        })

    # CTR triggers: cash > Rs.10 lakh (PMLA threshold)
    ctr_account = random_account()
    for j in range(14):
        txn_date = date.today() - timedelta(days=random.randint(1, 60))
        rows.append({
            "txn_id": f"CTR{j:04d}",
            "account_number": ctr_account,
            "txn_date": txn_date.isoformat(),
            "txn_type": "Credit",
            "txn_mode": "Cash",
            "amount": round(random.uniform(1_000_001, 5_000_000), 2),
            "counterparty": random_name(),
            "branch": random.choice(BRANCHES),
            "purpose": "Business Receipt",
        })

    # Structuring: 5 near-threshold cash txns from same account within one week
    struct_account = random_account()
    base_date = date.today() - timedelta(days=30)
    for k in range(5):
        rows.append({
            "txn_id": f"STR{k:04d}",
            "account_number": struct_account,
            "txn_date": (base_date + timedelta(days=k)).isoformat(),
            "txn_type": "Credit",
            "txn_mode": "Cash",
            "amount": round(random.uniform(980_000, 995_000), 2),
            "counterparty": "Unknown Entity",
            "branch": "Mumbai Main",
            "purpose": "Business Receipt",
        })

    df = pd.DataFrame(rows)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)

    out_dir = os.path.join(os.path.dirname(__file__), "..", "..", "sample_data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "transactions.csv")
    df.to_csv(out_path, index=False)

    cash_above_10L = len(df[(df["txn_mode"] == "Cash") & (df["amount"] >= 1_000_000)])
    print(f"Generated {len(df)} transactions -> {out_path}")
    print(f"  Cash transactions >= 10 lakh (CTR triggers): {cash_above_10L}")
    print(f"  Structuring account: {struct_account}")


if __name__ == "__main__":
    main()
