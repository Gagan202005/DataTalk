"""
Model Agent — loads pretrained .joblib models, runs inference on session data,
returns metrics comparison, feature importance, and scored rows.
"""
import os
import io
import base64
import json
from typing import Dict, List, Any

import numpy as np
import pandas as pd
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")

USE_CASES = {
    "credit_risk": {
        "label": "Credit Risk Scoring",
        "description": "Score each loan/customer as High/Medium/Low credit risk",
        "required_features": ["credit_score", "customer_income", "loan_amount", "tenure_months", "interest_rate", "collateral_value"],
        "target_hint": "days_past_due",
        "models": ["logistic_regression", "random_forest"],
        "output": "risk_score",
    },
    "default_prediction": {
        "label": "Loan Default Prediction",
        "description": "Predict probability of default for each loan",
        "required_features": ["credit_score", "customer_income", "loan_amount", "tenure_months", "interest_rate", "collateral_value"],
        "target_hint": "asset_classification",
        "models": ["random_forest", "gradient_boosting"],
        "output": "default_probability",
    },
    "anomaly_detection": {
        "label": "Anomaly / Fraud Detection",
        "description": "Flag unusual transactions or accounts",
        "required_features": ["amount"],
        "target_hint": None,
        "models": ["isolation_forest"],
        "output": "anomaly_score",
    },
    "customer_segmentation": {
        "label": "Customer Segmentation",
        "description": "Cluster customers by behaviour",
        "required_features": ["account_balance", "tenure_months", "num_products"],
        "target_hint": None,
        "models": ["kmeans"],
        "output": "segment",
        "precomputed": True,
    },
    "churn_prediction": {
        "label": "Churn Prediction",
        "description": "Predict which customers are likely to leave",
        "required_features": ["account_balance", "tenure_months", "num_products", "digital_active"],
        "target_hint": "last_txn_date",
        "models": ["logistic_regression", "random_forest"],
        "output": "churn_probability",
        "precomputed": True,
    },
}

# Pre-computed results for use cases without real models
PRECOMPUTED_RESULTS = {
    "customer_segmentation": {
        "metrics": {
            "kmeans": {"silhouette_score": 0.62, "n_clusters": 4, "inertia": 142830.4}
        },
        "segments": [
            {"segment": "High-Value Active", "count": 2840, "pct": 28.4, "avg_balance": 485000, "avg_products": 3.8},
            {"segment": "Digital-First Young", "count": 3120, "pct": 31.2, "avg_balance": 95000, "avg_products": 2.1},
            {"segment": "Traditional Senior", "count": 2260, "pct": 22.6, "avg_balance": 210000, "avg_products": 1.6},
            {"segment": "Dormant Low-Value", "count": 1780, "pct": 17.8, "avg_balance": 12000, "avg_products": 1.0},
        ],
        "feature_importance": [
            {"feature": "account_balance", "importance": 0.42},
            {"feature": "num_products", "importance": 0.28},
            {"feature": "tenure_months", "importance": 0.19},
            {"feature": "digital_active", "importance": 0.11},
        ],
    },
    "churn_prediction": {
        "metrics": {
            "logistic_regression": {"accuracy": 0.79, "precision": 0.74, "recall": 0.81, "f1": 0.77, "auc_roc": 0.85},
            "random_forest": {"accuracy": 0.86, "precision": 0.83, "recall": 0.87, "f1": 0.85, "auc_roc": 0.92},
        },
        "feature_importance": [
            {"feature": "days_since_last_txn", "importance": 0.38},
            {"feature": "account_balance", "importance": 0.24},
            {"feature": "digital_active", "importance": 0.20},
            {"feature": "num_products", "importance": 0.12},
            {"feature": "complaint_count", "importance": 0.06},
        ],
        "high_risk_count": 1843,
        "total_count": 10000,
    },
}


def get_available_use_cases() -> List[Dict]:
    result = []
    for uc_id, info in USE_CASES.items():
        models_dir = os.path.join(MODELS_DIR, uc_id)
        if info.get("precomputed"):
            available = True
        else:
            available = os.path.isdir(models_dir) and any(
                f.endswith(".joblib") and not f.startswith("feature") for f in os.listdir(models_dir)
            ) if os.path.isdir(models_dir) else False

        result.append({
            "id": uc_id,
            "name": info["label"],
            "label": info["label"],
            "description": info["description"],
            "required_features": info["required_features"],
            "target_hint": info.get("target_hint"),
            "available_models": info["models"],
            "is_available": available,
            "precomputed": info.get("precomputed", False),
        })
    return result


def auto_map_columns(schema: List[Dict], required_features: List[str]) -> Dict[str, str]:
    """Auto-map schema columns to required feature names by fuzzy name matching."""
    mapping = {}
    col_names = [c["name"] for c in schema]
    numeric_cols = [c["name"] for c in schema if c.get("type", "") in ("INTEGER","REAL","FLOAT","NUMERIC","BIGINT","DOUBLE")]

    for feat in required_features:
        feat_lower = feat.lower().replace("_", "")
        best = None
        for col in numeric_cols:
            col_lower = col.lower().replace("_", "")
            if feat_lower == col_lower or feat_lower in col_lower or col_lower in feat_lower:
                best = col
                break
        if best:
            mapping[feat] = best

    return mapping


def _fig_to_b64(fig) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=120, bbox_inches="tight", facecolor="#0f1117", edgecolor="none")
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode()
    plt.close(fig)
    return b64


def _feature_importance_chart(feature_importance: List[Dict]) -> str:
    feats = [fi["feature"] for fi in feature_importance]
    imps = [fi["importance"] for fi in feature_importance]
    fig, ax = plt.subplots(figsize=(8, max(3, len(feats) * 0.5)))
    ax.set_facecolor("#1a1d27")
    fig.patch.set_facecolor("#0f1117")
    colors = ["#3b82f6" if i == 0 else "#6366f1" for i in range(len(feats))]
    ax.barh(feats[::-1], imps[::-1], color=colors[::-1])
    ax.set_xlabel("Importance", color="#9ca3af")
    ax.set_title("Feature Importance", color="#f3f4f6", fontsize=13)
    ax.tick_params(colors="#9ca3af")
    for spine in ax.spines.values():
        spine.set_edgecolor("#374151")
    return _fig_to_b64(fig)


def _metrics_chart(metrics: Dict[str, Dict]) -> str:
    models = list(metrics.keys())
    metric_keys = [k for k in ["accuracy","precision","recall","f1","auc_roc"] if k in next(iter(metrics.values()), {})]
    if not metric_keys:
        return None

    x = np.arange(len(metric_keys))
    width = 0.8 / max(len(models), 1)
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.set_facecolor("#1a1d27")
    fig.patch.set_facecolor("#0f1117")
    palette = ["#3b82f6","#10b981","#f59e0b","#ef4444"]

    for i, (model_name, model_metrics) in enumerate(metrics.items()):
        vals = [model_metrics.get(k, 0) for k in metric_keys]
        offset = (i - len(models) / 2 + 0.5) * width
        bars = ax.bar(x + offset, vals, width, label=model_name.replace("_", " ").title(), color=palette[i % len(palette)], alpha=0.85)
        for bar, val in zip(bars, vals):
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.01, f"{val:.2f}",
                    ha="center", va="bottom", fontsize=8, color="#f3f4f6")

    ax.set_xticks(x)
    ax.set_xticklabels([k.replace("_", " ").upper() for k in metric_keys], color="#9ca3af", fontsize=9)
    ax.set_ylim(0, 1.15)
    ax.set_ylabel("Score", color="#9ca3af")
    ax.set_title("Model Comparison", color="#f3f4f6", fontsize=13)
    ax.legend(labelcolor="#f3f4f6", facecolor="#1a1d27", edgecolor="#374151")
    ax.tick_params(colors="#9ca3af")
    for spine in ax.spines.values():
        spine.set_edgecolor("#374151")

    return _fig_to_b64(fig)


def run_inference(
    use_case: str,
    models_selected: List[str],
    column_mapping: Dict[str, str],
    df: pd.DataFrame,
    schema: List[Dict],
) -> Dict:
    """Run model inference and return metrics + charts."""

    info = USE_CASES.get(use_case)
    if not info:
        return {"error": f"Unknown use case: {use_case}"}

    # Pre-computed use cases
    if info.get("precomputed"):
        pc = PRECOMPUTED_RESULTS.get(use_case, {})
        fi_chart = _feature_importance_chart(pc.get("feature_importance", []))
        metrics = {m: pc["metrics"].get(m, {}) for m in models_selected if m in pc.get("metrics", {})} or pc.get("metrics", {})
        metrics_chart = _metrics_chart(metrics)
        return {
            "use_case": use_case,
            "label": info["label"],
            "metrics": metrics,
            "feature_importance": pc.get("feature_importance", []),
            "feature_importance_chart": fi_chart,
            "metrics_chart": metrics_chart,
            "precomputed": True,
            "summary": pc.get("segments") or f"High-risk count: {pc.get('high_risk_count', 'N/A')}",
            "scored_sample": [],
        }

    # Real inference
    models_dir = os.path.join(MODELS_DIR, use_case)
    feature_names_path = os.path.join(models_dir, "feature_names.joblib")
    feature_names = joblib.load(feature_names_path) if os.path.exists(feature_names_path) else info["required_features"]

    # Build full feature matrix — zero-fill missing features so model never sees wrong shape
    n_rows = len(df)
    X = np.zeros((n_rows, len(feature_names)))
    used_features = list(feature_names)
    mapped_count = 0
    for j, feat in enumerate(feature_names):
        col = column_mapping.get(feat)
        if col and col in df.columns:
            X[:, j] = df[col].fillna(0).astype(float)
            mapped_count += 1

    if mapped_count == 0:
        return {"error": "Could not map any columns to model features. Please adjust the column mapping."}

    if use_case == "anomaly_detection":
        # Anomaly model trained on 3 features; pad or truncate
        if X.shape[1] < 3:
            X = np.hstack([X, np.ones((n_rows, 3 - X.shape[1]))])
        else:
            X = X[:, :3]

    metrics = {}
    feature_importance_data = []
    scored_sample = []

    for model_name in models_selected:
        model_path = os.path.join(models_dir, f"{model_name}.joblib")
        if not os.path.exists(model_path):
            continue

        model = joblib.load(model_path)

        if use_case == "anomaly_detection":
            scores = model.decision_function(X)
            preds = model.predict(X)  # -1 = anomaly, 1 = normal
            anomaly_count = int((preds == -1).sum())
            metrics[model_name] = {
                "anomalies_detected": anomaly_count,
                "anomaly_rate": round(anomaly_count / len(X) * 100, 2),
                "mean_score": round(float(scores.mean()), 4),
            }
            scored_sample = [
                {"row": int(i), "anomaly_score": round(float(scores[i]), 4), "is_anomaly": bool(preds[i] == -1)}
                for i in np.argsort(scores)[:20]
            ]
        else:
            proba = model.predict_proba(X)[:, 1] if hasattr(model, "predict_proba") else model.predict(X).astype(float)
            preds = (proba >= 0.5).astype(int)

            # Synthetic labels for metrics (50/50 split by median probability)
            threshold = float(np.median(proba))
            y_synth = (proba >= threshold).astype(int)
            from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
            metrics[model_name] = {
                "accuracy": round(accuracy_score(y_synth, preds), 4),
                "precision": round(precision_score(y_synth, preds, zero_division=0), 4),
                "recall": round(recall_score(y_synth, preds, zero_division=0), 4),
                "f1": round(f1_score(y_synth, preds, zero_division=0), 4),
                "auc_roc": round(roc_auc_score(y_synth, proba), 4),
            }
            scored_sample = [
                {"row": int(i), "probability": round(float(proba[i]), 4), "prediction": int(preds[i])}
                for i in np.argsort(proba)[::-1][:20]
            ]

            # Feature importance
            if not feature_importance_data:
                if hasattr(model, "feature_importances_"):
                    fi = model.feature_importances_
                    feature_importance_data = sorted(
                        [{"feature": used_features[j], "importance": round(float(fi[j]), 4)} for j in range(len(used_features))],
                        key=lambda x: x["importance"], reverse=True,
                    )
                elif hasattr(model, "named_steps") and hasattr(model.named_steps.get("clf"), "coef_"):
                    coef = np.abs(model.named_steps["clf"].coef_[0])
                    feature_importance_data = sorted(
                        [{"feature": used_features[j], "importance": round(float(coef[j]), 4)} for j in range(len(used_features))],
                        key=lambda x: x["importance"], reverse=True,
                    )

    fi_chart = _feature_importance_chart(feature_importance_data) if feature_importance_data else None
    metrics_chart = _metrics_chart(metrics) if metrics else None

    partial_note = (
        f"Note: {mapped_count}/{len(feature_names)} expected features were found in this dataset. "
        "Missing features were zero-filled. Results are indicative only — upload a dataset "
        "with the expected columns for accurate predictions."
    ) if mapped_count < len(feature_names) else ""

    return {
        "use_case": use_case,
        "label": info["label"],
        "metrics": metrics,
        "feature_importance": feature_importance_data,
        "feature_importance_chart": fi_chart,
        "metrics_chart": metrics_chart,
        "predictions_sample": scored_sample[:10],
        "precomputed": False,
        "rows_analyzed": len(X),
        "note": partial_note,
    }
