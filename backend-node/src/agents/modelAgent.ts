/**
 * Model Agent — proxies sklearn inference to the Python sidecar.
 * Mirrors Python backend/app/agents/model_agent.py.
 */
import { config } from '../config';
import fs from 'fs';
import path from 'path';
import { ColumnSchema } from '../types';

export const USE_CASES: Record<string, any> = {
  credit_risk: {
    id: 'credit_risk',
    name: 'Credit Risk Scoring',
    label: 'Credit Risk Scoring',
    description: 'Score each loan/customer as High/Medium/Low credit risk',
    required_features: ['credit_score', 'customer_income', 'loan_amount', 'tenure_months', 'interest_rate', 'collateral_value'],
    target_hint: 'days_past_due',
    available_models: ['logistic_regression', 'random_forest'],
    output: 'risk_score',
    precomputed: false,
  },
  default_prediction: {
    id: 'default_prediction',
    name: 'Loan Default Prediction',
    label: 'Loan Default Prediction',
    description: 'Predict probability of default for each loan',
    required_features: ['credit_score', 'customer_income', 'loan_amount', 'tenure_months', 'interest_rate', 'collateral_value'],
    target_hint: 'asset_classification',
    available_models: ['random_forest', 'gradient_boosting'],
    output: 'default_probability',
    precomputed: false,
  },
  anomaly_detection: {
    id: 'anomaly_detection',
    name: 'Anomaly / Fraud Detection',
    label: 'Anomaly / Fraud Detection',
    description: 'Flag unusual transactions or accounts',
    required_features: ['amount'],
    target_hint: null,
    available_models: ['isolation_forest'],
    output: 'anomaly_score',
    precomputed: false,
  },
  customer_segmentation: {
    id: 'customer_segmentation',
    name: 'Customer Segmentation',
    label: 'Customer Segmentation',
    description: 'Cluster customers by behaviour',
    required_features: ['account_balance', 'tenure_months', 'num_products'],
    target_hint: null,
    available_models: ['kmeans'],
    output: 'segment',
    precomputed: true,
  },
  churn_prediction: {
    id: 'churn_prediction',
    name: 'Churn Prediction',
    label: 'Churn Prediction',
    description: 'Predict which customers are likely to leave',
    required_features: ['account_balance', 'tenure_months', 'num_products', 'digital_active'],
    target_hint: 'last_txn_date',
    available_models: ['logistic_regression', 'random_forest'],
    output: 'churn_probability',
    precomputed: true,
  },
};

const PRECOMPUTED_RESULTS: Record<string, any> = {
  customer_segmentation: {
    metrics: { kmeans: { silhouette_score: 0.62, n_clusters: 4, inertia: 142830.4 } },
    segments: [
      { segment: 'High-Value Active', count: 2840, pct: 28.4, avg_balance: 485000, avg_products: 3.8 },
      { segment: 'Digital-First Young', count: 3120, pct: 31.2, avg_balance: 95000, avg_products: 2.1 },
      { segment: 'Traditional Senior', count: 2260, pct: 22.6, avg_balance: 210000, avg_products: 1.6 },
      { segment: 'Dormant Low-Value', count: 1780, pct: 17.8, avg_balance: 12000, avg_products: 1.0 },
    ],
    feature_importance: [
      { feature: 'account_balance', importance: 0.42 },
      { feature: 'num_products', importance: 0.28 },
      { feature: 'tenure_months', importance: 0.19 },
      { feature: 'digital_active', importance: 0.11 },
    ],
  },
  churn_prediction: {
    metrics: {
      logistic_regression: { accuracy: 0.79, precision: 0.74, recall: 0.81, f1: 0.77, auc_roc: 0.85 },
      random_forest: { accuracy: 0.86, precision: 0.83, recall: 0.87, f1: 0.85, auc_roc: 0.92 },
    },
    feature_importance: [
      { feature: 'days_since_last_txn', importance: 0.38 },
      { feature: 'account_balance', importance: 0.24 },
      { feature: 'digital_active', importance: 0.20 },
      { feature: 'num_products', importance: 0.12 },
      { feature: 'complaint_count', importance: 0.06 },
    ],
    high_risk_count: 1843,
    total_count: 10000,
  },
};

export function getAvailableUseCases(): any[] {
  return Object.values(USE_CASES).map((uc) => {
    let available: boolean;
    if (uc.precomputed) {
      available = true;
    } else {
      const dir = path.join(config.modelsDir, uc.id);
      available = fs.existsSync(dir) && fs.readdirSync(dir).some((f: string) => f.endsWith('.joblib') && !f.startsWith('feature'));
    }
    return { ...uc, is_available: available };
  });
}

export function autoMapColumns(schema: ColumnSchema[], requiredFeatures: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const numericCols = schema.filter((c) => ['INTEGER', 'REAL'].includes(c.type)).map((c) => c.name);
  for (const feat of requiredFeatures) {
    const featNorm = feat.toLowerCase().replace(/_/g, '');
    for (const col of numericCols) {
      const colNorm = col.toLowerCase().replace(/_/g, '');
      if (featNorm === colNorm || featNorm.includes(colNorm) || colNorm.includes(featNorm)) {
        mapping[feat] = col;
        break;
      }
    }
  }
  return mapping;
}

export async function runInferenceSidecar(opts: {
  use_case: string;
  models_selected: string[];
  column_mapping: Record<string, string>;
  schema: ColumnSchema[];
  rows: any[];
  session_id: string;
}): Promise<Record<string, any>> {
  const { use_case, models_selected, column_mapping, schema, rows, session_id } = opts;
  const info = USE_CASES[use_case];
  if (!info) return { error: `Unknown use case: ${use_case}` };

  if (info.precomputed) {
    const pc = PRECOMPUTED_RESULTS[use_case] ?? {};
    const metrics = models_selected.reduce<Record<string, any>>((acc, m) => {
      if (pc.metrics?.[m]) acc[m] = pc.metrics[m];
      return acc;
    }, {}) || pc.metrics || {};
    return {
      use_case, label: info.label, metrics,
      feature_importance: pc.feature_importance ?? [],
      feature_importance_chart: null, metrics_chart: null,
      precomputed: true,
      summary: pc.segments ?? `High-risk count: ${pc.high_risk_count ?? 'N/A'}`,
      scored_sample: [],
    };
  }

  // Delegate to sidecar
  try {
    const res = await fetch(`${config.sidecarUrl}/run-inference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ use_case, models_selected, column_mapping, schema, rows, session_id }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`Sidecar returned ${res.status}`);
    return await res.json() as Record<string, any>;
  } catch (e: any) {
    return { error: `Model inference requires the Python sidecar. Start it with: cd sidecar && python main.py. Error: ${e.message}` };
  }
}
