"""
Generate synthetic customer base (10,000 rows) for DataTalk demo.
Run: python -m app.synthetic_data.generate_customers
Output: backend/sample_data/customers.csv
"""
import random
from datetime import date, timedelta
import pandas as pd
import numpy as np
import os

random.seed(44)
np.random.seed(44)

FIRST = ["Aarav","Priya","Rahul","Sneha","Vikram","Ananya","Rajesh","Kavya","Amit","Pooja",
         "Sanjay","Meera","Deepak","Nisha","Arjun","Sunita","Rohan","Divya","Arun","Lakshmi"]
LAST  = ["Sharma","Verma","Patel","Singh","Kumar","Gupta","Joshi","Rao","Mehta","Nair"]
OCCUPATIONS   = ["Salaried","Self-employed","Business","Retired","Student"]
ACCOUNT_TYPES = ["Savings","Current","FD","RD"]


def random_name():
    return f"{random.choice(FIRST)} {random.choice(LAST)}"


def main():
    n = 10_000
    rows = []
    for i in range(1, n + 1):
        cid = f"C{i:06d}"
        name = random_name()
        age  = int(np.clip(np.random.normal(38, 12), 18, 80))
        gender = random.choices(["Male","Female","Other"], weights=[52,47,1])[0]
        occupation = random.choice(OCCUPATIONS)

        if occupation == "Retired":
            income = round(random.uniform(200_000, 800_000) / 10_000) * 10_000
        elif occupation == "Student":
            income = round(random.uniform(0, 200_000) / 10_000) * 10_000
        elif occupation == "Business":
            income = round(random.uniform(500_000, 5_000_000) / 10_000) * 10_000
        else:
            income = round(random.uniform(300_000, 2_000_000) / 10_000) * 10_000

        account_type = random.choices(ACCOUNT_TYPES, weights=[55,20,15,10])[0]
        tenure_months = int(np.clip(np.random.exponential(48), 1, 300))
        num_products = random.choices([1,2,3,4,5], weights=[30,30,20,15,5])[0]
        digital_active = random.choices([True,False], weights=[65,35])[0]
        complaint_count = random.choices([0,1,2,3,4], weights=[70,18,7,4,1])[0]

        # Balance correlated with income and products
        base_balance = income * random.uniform(0.05, 0.4)
        account_balance = round(base_balance / 1000) * 1000

        # Churn signals: low balance + not digital + long gap since last txn
        churn_probability = 0.05
        if not digital_active:
            churn_probability += 0.15
        if account_balance < 10_000:
            churn_probability += 0.20
        if num_products == 1:
            churn_probability += 0.10
        if tenure_months > 120:
            churn_probability += 0.05

        is_churner = random.random() < churn_probability
        if is_churner:
            days_since_last = random.randint(90, 365)
        else:
            days_since_last = random.randint(1, 60)

        last_txn_date = (date.today() - timedelta(days=days_since_last)).isoformat()

        rows.append({
            "customer_id": cid,
            "name": name,
            "age": age,
            "gender": gender,
            "income": income,
            "occupation": occupation,
            "account_type": account_type,
            "account_balance": account_balance,
            "tenure_months": tenure_months,
            "num_products": num_products,
            "digital_active": digital_active,
            "complaint_count": complaint_count,
            "last_txn_date": last_txn_date,
        })

    df = pd.DataFrame(rows)
    out_dir = os.path.join(os.path.dirname(__file__), "..", "..", "sample_data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "customers.csv")
    df.to_csv(out_path, index=False)

    churners = len(df[df["last_txn_date"] < (date.today() - timedelta(days=90)).isoformat()])
    digital = len(df[df["digital_active"] == True])
    print(f"Generated {len(df)} customers -> {out_path}")
    print(f"  Likely churners (>90 days since last txn): {churners}")
    print(f"  Digital-active customers: {digital} ({digital/len(df)*100:.0f}%)")


if __name__ == "__main__":
    main()
