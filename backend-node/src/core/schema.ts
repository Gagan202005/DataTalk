/**
 * Schema extraction from parsed row arrays.
 */
import { ParsedRow, ColumnSchema, DataQuality, Anomaly, MetricDefinition } from '../types';

function mapType(values: (string | number | boolean | null)[]): ColumnSchema['type'] {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== '');
  if (nonNull.length === 0) return 'TEXT';
  const allBool = nonNull.every((v) => typeof v === 'boolean' || v === 0 || v === 1);
  if (allBool && nonNull.some((v) => typeof v === 'boolean')) return 'BOOLEAN';
  if (nonNull.every((v) => typeof v === 'number' && Number.isInteger(v))) return 'INTEGER';
  if (nonNull.every((v) => typeof v === 'number')) return 'REAL';
  const sample = String(nonNull[0]);
  if (/^\d{4}-\d{2}-\d{2}/.test(sample)) return 'DATETIME';
  return 'TEXT';
}

export function extractSchema(rows: ParsedRow[]): ColumnSchema[] {
  if (rows.length === 0) return [];
  const columns = Object.keys(rows[0]);
  return columns.map((col) => {
    const vals = rows.map((r) => r[col]);
    const nonNull = vals.filter((v) => v !== null && v !== undefined && v !== '');
    const missingCount = vals.length - nonNull.length;
    const missingPct = Math.round((missingCount / Math.max(vals.length, 1)) * 1000) / 10;
    const sampleVals = nonNull.slice(0, 3).map(String);
    return {
      name: col,
      type: mapType(vals),
      sample_values: sampleVals,
      missing_pct: missingPct,
    };
  });
}

export function assessDataQuality(rows: ParsedRow[]): DataQuality {
  if (rows.length === 0) return { overall_score: 100, total_missing_pct: 0, duplicate_rows: 0, issues: [] };
  const columns = Object.keys(rows[0]);
  let totalCells = rows.length * columns.length;
  let totalMissing = 0;
  const issues: string[] = [];

  for (const col of columns) {
    let colMissing = 0;
    rows.forEach((r) => {
      if (r[col] === null || r[col] === undefined || r[col] === '') colMissing++;
    });
    totalMissing += colMissing;
    const pct = Math.round((colMissing / rows.length) * 1000) / 10;
    if (pct > 20) issues.push(`Column '${col}' has ${pct}% missing values`);
  }

  const missingPct = Math.round((totalMissing / Math.max(totalCells, 1)) * 1000) / 10;

  // Count duplicates
  const seen = new Set<string>();
  let duplicates = 0;
  for (const row of rows) {
    const key = JSON.stringify(row);
    if (seen.has(key)) duplicates++;
    else seen.add(key);
  }

  const dupPenalty = Math.min(10, (duplicates / Math.max(rows.length, 1)) * 100);
  const score = Math.max(0, Math.round(100 - missingPct - dupPenalty));

  return { overall_score: score, total_missing_pct: missingPct, duplicate_rows: duplicates, issues };
}

export function detectAnomalies(rows: ParsedRow[]): Anomaly[] {
  if (rows.length === 0) return [];
  const columns = Object.keys(rows[0]);
  const anomalies: Anomaly[] = [];

  for (const col of columns) {
    const nums = rows
      .map((r) => r[col])
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
    if (nums.length < 3) continue;

    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    const std = Math.sqrt(nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length);
    if (std === 0) continue;

    const outlierCount = nums.filter((v) => Math.abs(v - mean) > 3 * std).length;
    if (outlierCount > 0) {
      anomalies.push({
        column: col,
        count: outlierCount,
        message: `${outlierCount} suspicious value${outlierCount > 1 ? 's' : ''} in '${col}' (outside normal range)`,
      });
    }
    if (anomalies.length >= 5) break;
  }

  return anomalies;
}

export function suggestMetrics(rows: ParsedRow[]): MetricDefinition[] {
  if (rows.length === 0) return [];
  const columns = Object.keys(rows[0]);
  const suggestions: MetricDefinition[] = [];

  for (const col of columns) {
    const vals = rows.map((r) => r[col]).filter((v) => v !== null);
    if (vals.every((v) => typeof v === 'number')) {
      suggestions.push({ name: `total_${col}`, expression: `SUM(${col})`, description: `Sum of all ${col} values` });
      suggestions.push({ name: `avg_${col}`, expression: `AVG(${col})`, description: `Average ${col} value` });
    }
    if (suggestions.length >= 6) break;
  }

  return suggestions.slice(0, 6);
}
