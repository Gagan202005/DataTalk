"""
One-time script: train and save pretrained ML models for the Model Lab.
Run from backend/: python -m app.models.train_models
Output: .joblib files in backend/app/models/{use_case}/
"""
import os
import numpy as np
import joblib
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

np.random.seed(42)


def make_loan_data(n=10000):
    """Synthetic training data matching loan_portfolio.csv schema."""
    credit_score = np.random.normal(680, 90, n).clip(300, 900)
    income = np.random.exponential(500_000, n).clip(100_000, 5_000_000)
    loan_amount = np.random.exponential(1_000_000, n).clip(50_000, 50_000_000)
    tenure = np.random.choice([12, 24, 36, 60, 84, 120, 180, 240], n)
    rate = np.random.uniform(7, 18, n)
    collateral = np.random.exponential(2_000_000, n).clip(0, 20_000_000)
    ltv = np.where(collateral > 0, loan_amount / collateral, 1.5)

    # Default probability
    p_default = (
        0.3
        - (credit_score - 300) / 600 * 0.25
        + (loan_amount / income) * 0.08
        + (rate - 7) / 11 * 0.12
        - (collateral / (loan_amount + 1)) * 0.05
    ).clip(0.01, 0.95)
    default = (np.random.random(n) < p_default).astype(int)

    X = np.column_stack([credit_score, income, loan_amount, tenure, rate, collateral, ltv])
    return X, default


def make_transaction_data(n=10000):
    """Synthetic training data for anomaly detection."""
    amounts = np.random.exponential(50_000, n).clip(100, 500_000)
    hour = np.random.randint(0, 24, n)
    freq = np.random.exponential(5, n).clip(1, 50)
    X = np.column_stack([amounts, hour, freq])
    return X


def train_credit_risk():
    out_dir = os.path.join(os.path.dirname(__file__), "credit_risk")
    os.makedirs(out_dir, exist_ok=True)
    X, y = make_loan_data(12000)

    # Logistic Regression
    lr_pipe = Pipeline([("scaler", StandardScaler()), ("clf", LogisticRegression(max_iter=1000, random_state=42))])
    lr_pipe.fit(X, y)
    joblib.dump(lr_pipe, os.path.join(out_dir, "logistic_regression.joblib"))
    print("  Saved credit_risk/logistic_regression.joblib")

    # Random Forest
    rf = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42, n_jobs=-1)
    rf.fit(X, y)
    joblib.dump(rf, os.path.join(out_dir, "random_forest.joblib"))
    print("  Saved credit_risk/random_forest.joblib")

    # Feature names for importance charts
    feature_names = ["credit_score", "customer_income", "loan_amount", "tenure_months", "interest_rate", "collateral_value", "ltv_ratio"]
    joblib.dump(feature_names, os.path.join(out_dir, "feature_names.joblib"))


def train_default_prediction():
    out_dir = os.path.join(os.path.dirname(__file__), "default_prediction")
    os.makedirs(out_dir, exist_ok=True)
    X, y = make_loan_data(12000)

    # Random Forest (different params)
    rf = RandomForestClassifier(n_estimators=150, max_depth=10, min_samples_leaf=5, random_state=42, n_jobs=-1)
    rf.fit(X, y)
    joblib.dump(rf, os.path.join(out_dir, "random_forest.joblib"))
    print("  Saved default_prediction/random_forest.joblib")

    # Gradient Boosting
    gb = GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, max_depth=5, random_state=42)
    gb.fit(X, y)
    joblib.dump(gb, os.path.join(out_dir, "gradient_boosting.joblib"))
    print("  Saved default_prediction/gradient_boosting.joblib")

    feature_names = ["credit_score", "customer_income", "loan_amount", "tenure_months", "interest_rate", "collateral_value", "ltv_ratio"]
    joblib.dump(feature_names, os.path.join(out_dir, "feature_names.joblib"))


def train_anomaly_detection():
    out_dir = os.path.join(os.path.dirname(__file__), "anomaly_detection")
    os.makedirs(out_dir, exist_ok=True)
    X = make_transaction_data(10000)

    isoforest = IsolationForest(contamination=0.05, random_state=42, n_jobs=-1)
    isoforest.fit(X)
    joblib.dump(isoforest, os.path.join(out_dir, "isolation_forest.joblib"))
    print("  Saved anomaly_detection/isolation_forest.joblib")

    feature_names = ["amount", "hour_of_day", "transaction_frequency"]
    joblib.dump(feature_names, os.path.join(out_dir, "feature_names.joblib"))


if __name__ == "__main__":
    print("Training credit risk models...")
    train_credit_risk()
    print("Training default prediction models...")
    train_default_prediction()
    print("Training anomaly detection models...")
    train_anomaly_detection()
    print("All models trained and saved.")
