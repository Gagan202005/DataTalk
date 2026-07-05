/**
 * Data Preprocessing Engine.
 */
import { ParsedRow, PreprocessIssue, PreprocessResult } from '../types';

// ─────────────────────────────────────────────
// STEP 1 — Duplicate rows (zero risk, auto)
// ─────────────────────────────────────────────
function detectDuplicates(rows: ParsedRow[]): PreprocessIssue[] {
  const seen = new Set<string>();
  let count = 0;
  for (const row of rows) {
    const key = JSON.stringify(row);
    if (seen.has(key)) count++;
    else seen.add(key);
  }
  if (count === 0) return [];
  return [{
    step_id: 'duplicate_rows',
    title: 'Duplicate Rows Found',
    description: `${count} rows are exact copies of other rows.`,
    affected: 'All rows',
    examples: [`Row duplicated ${count} time(s) total`],
    fix_description: `Remove ${count} duplicate rows, keep first occurrence.`,
    risk: 'zero',
  }];
}

function applyDuplicates(rows: ParsedRow[]): [ParsedRow[], PreprocessResult] {
  const seen = new Set<string>();
  const deduped = rows.filter((r) => {
    const key = JSON.stringify(r);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [deduped, { step_id: 'duplicate_rows', description: `Removed ${rows.length - deduped.length} duplicate rows`, rows_affected: rows.length - deduped.length }];
}

// ─────────────────────────────────────────────
// STEP 2 — Empty rows (zero risk, auto)
// ─────────────────────────────────────────────
function detectEmptyRows(rows: ParsedRow[]): PreprocessIssue[] {
  const count = rows.filter((r) => Object.values(r).every((v) => v === null || v === undefined || v === '')).length;
  if (count === 0) return [];
  return [{
    step_id: 'empty_rows',
    title: 'Empty Rows Found',
    description: `${count} rows have no data at all.`,
    affected: 'All rows',
    examples: [`${count} fully blank row(s)`],
    fix_description: `Remove ${count} empty rows.`,
    risk: 'zero',
  }];
}

function applyEmptyRows(rows: ParsedRow[]): [ParsedRow[], PreprocessResult] {
  const filtered = rows.filter((r) => !Object.values(r).every((v) => v === null || v === undefined || v === ''));
  return [filtered, { step_id: 'empty_rows', description: `Removed ${rows.length - filtered.length} empty rows`, rows_affected: rows.length - filtered.length }];
}

// ─────────────────────────────────────────────
// STEP 3 — Whitespace (zero risk, auto)
// ─────────────────────────────────────────────
function detectWhitespace(rows: ParsedRow[]): PreprocessIssue[] {
  if (rows.length === 0) return [];
  const cols = Object.keys(rows[0]);
  const affected: string[] = [];
  for (const col of cols) {
    const hasWs = rows.some((r) => typeof r[col] === 'string' && /^\s+|\s+$/.test(r[col] as string));
    if (hasWs) affected.push(col);
  }
  if (affected.length === 0) return [];
  return [{
    step_id: 'whitespace',
    title: 'Extra Whitespace in Text',
    description: `${affected.length} column(s) have leading/trailing spaces.`,
    affected: affected.slice(0, 3).join(', '),
    examples: ['" London " → "London"', '" UK " → "UK"'],
    fix_description: 'Strip leading and trailing spaces from all text values.',
    risk: 'zero',
  }];
}

function applyWhitespace(rows: ParsedRow[]): [ParsedRow[], PreprocessResult] {
  let count = 0;
  const cleaned = rows.map((r) => {
    const out = { ...r };
    for (const [k, v] of Object.entries(out)) {
      if (typeof v === 'string') {
        const trimmed = v.trim();
        if (trimmed !== v) { out[k] = trimmed; count++; }
      }
    }
    return out;
  });
  return [cleaned, { step_id: 'whitespace', description: `Stripped whitespace from ${count} values`, rows_affected: count }];
}

// ─────────────────────────────────────────────
// STEP 4 — Numeric as text (medium risk, ask user)
// ─────────────────────────────────────────────
function isNumericText(vals: (string | number | boolean | null)[]): boolean {
  const sample = vals.filter((v) => v !== null && v !== undefined && v !== '').slice(0, 50);
  if (sample.length === 0) return false;
  if (!sample.every((v) => typeof v === 'string')) return false;
  const cleaned = (sample as string[]).map((s) => s.replace(/[£$€,%\s]/g, ''));
  const numericCount = cleaned.filter((s) => !isNaN(parseFloat(s)) && s.length > 0).length;
  return numericCount / sample.length >= 0.8;
}

function detectNumericAsText(rows: ParsedRow[]): PreprocessIssue[] {
  if (rows.length === 0) return [];
  const cols = Object.keys(rows[0]);
  const issues: PreprocessIssue[] = [];
  for (const col of cols) {
    const vals = rows.map((r) => r[col]);
    if (isNumericText(vals)) {
      const examples = vals.filter((v) => v !== null).slice(0, 3).map(String);
      issues.push({
        step_id: `numeric_as_text__${col}`,
        title: `'${col}' looks numeric but stored as text`,
        description: `Column '${col}' contains numeric values with currency symbols or commas.`,
        affected: col,
        examples,
        fix_description: `Strip £$€,% symbols and convert '${col}' to numbers.`,
        risk: 'medium',
      });
    }
  }
  return issues;
}

function applyNumericAsText(rows: ParsedRow[], col: string): [ParsedRow[], PreprocessResult] {
  let count = 0;
  const updated = rows.map((r) => {
    const out = { ...r };
    if (typeof out[col] === 'string') {
      const cleaned = (out[col] as string).replace(/[£$€,%\s]/g, '');
      const num = parseFloat(cleaned);
      if (!isNaN(num)) { out[col] = num; count++; }
    }
    return out;
  });
  return [updated, { step_id: `numeric_as_text__${col}`, description: `Converted '${col}' from text to numbers`, rows_affected: count }];
}

// ─────────────────────────────────────────────
// STEP 5 — Fill null values (medium risk, ask user)
// ─────────────────────────────────────────────
function detectNullFiller(rows: ParsedRow[]): PreprocessIssue[] {
  if (rows.length === 0) return [];
  const cols = Object.keys(rows[0]);
  const issues: PreprocessIssue[] = [];
  for (const col of cols) {
    const vals = rows.map((r) => r[col]);
    const nullCount = vals.filter((v) => v === null || v === undefined || v === '').length;
    const nullPct = (nullCount / rows.length) * 100;
    if (nullCount === 0 || nullPct > 60) continue;
    const nums = vals.filter((v): v is number => typeof v === 'number' && !isNaN(v));
    const strategy = nums.length > 0 ? `median value (${median(nums).toFixed(2)})` : '"Unknown"';
    issues.push({
      step_id: `null_filler__${col}`,
      title: `'${col}' has ${nullCount} missing values (${Math.round(nullPct)}%)`,
      description: `${nullCount} rows have no value in '${col}'.`,
      affected: col,
      examples: [`Row with NULL in '${col}'`],
      fix_description: `Fill ${nullCount} nulls in '${col}' with ${strategy}.`,
      risk: 'medium',
    });
  }
  return issues;
}

function applyNullFiller(rows: ParsedRow[], col: string): [ParsedRow[], PreprocessResult] {
  const nums = rows.map((r) => r[col]).filter((v): v is number => typeof v === 'number' && !isNaN(v));
  const isNumeric = nums.length > 0;
  const fillVal = isNumeric ? median(nums) : 'Unknown';
  let count = 0;
  const updated = rows.map((r) => {
    const out = { ...r };
    if (out[col] === null || out[col] === undefined || out[col] === '') {
      out[col] = fillVal as string | number;
      count++;
    }
    return out;
  });
  const desc = isNumeric
    ? `Filled ${count} nulls in '${col}' with median (${(fillVal as number).toFixed(2)})`
    : `Filled ${count} nulls in '${col}' with 'Unknown'`;
  return [updated, { step_id: `null_filler__${col}`, description: desc, rows_affected: count }];
}

// ─────────────────────────────────────────────
// STEP 6 — Date standardisation (medium risk, ask user)
// ─────────────────────────────────────────────
function detectDateStandardise(rows: ParsedRow[]): PreprocessIssue[] {
  if (rows.length === 0) return [];
  const cols = Object.keys(rows[0]);
  const issues: PreprocessIssue[] = [];
  const dateKeywords = ['date', 'time', 'day', 'month', 'year'];
  for (const col of cols) {
    const colLower = col.toLowerCase();
    if (!dateKeywords.some((kw) => colLower.includes(kw))) continue;
    const sample = rows.slice(0, 5).map((r) => String(r[col] ?? '')).filter(Boolean);
    const nonNull = rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && v !== '');
    const parseable = nonNull.filter((v) => {
      const d = new Date(String(v));
      return !isNaN(d.getTime());
    });
    const rate = parseable.length / Math.max(nonNull.length, 1);
    if (rate >= 0.7 && sample.length > 0) {
      issues.push({
        step_id: `date_standardise__${col}`,
        title: `'${col}' has mixed date formats`,
        description: `Column '${col}' contains dates in non-standard formats.`,
        affected: col,
        examples: sample.slice(0, 3),
        fix_description: `Convert '${col}' to standard YYYY-MM-DD format.`,
        risk: 'medium',
      });
    }
  }
  return issues;
}

function applyDateStandardise(rows: ParsedRow[], col: string): [ParsedRow[], PreprocessResult] {
  let count = 0;
  const updated = rows.map((r) => {
    const out = { ...r };
    if (out[col] !== null && out[col] !== undefined && out[col] !== '') {
      const d = new Date(String(out[col]));
      if (!isNaN(d.getTime())) {
        out[col] = d.toISOString().slice(0, 10);
        count++;
      }
    }
    return out;
  });
  return [updated, { step_id: `date_standardise__${col}`, description: `Standardised ${count} dates in '${col}' to YYYY-MM-DD`, rows_affected: count }];
}

// ─────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────
export function detectIssues(rows: ParsedRow[]): [ParsedRow[], Record<string, any>[], Record<string, any>[]] {
  let data = rows;
  const autoResults: Record<string, any>[] = [];
  const mediumIssues: Record<string, any>[] = [];

  // Auto-fix: empty rows
  const emptyIssues = detectEmptyRows(data);
  if (emptyIssues.length > 0) {
    const [fixed, res] = applyEmptyRows(data);
    data = fixed;
    if (res.rows_affected > 0) autoResults.push({ step_id: res.step_id, description: res.description, rows_affected: res.rows_affected });
  }

  // Auto-fix: duplicates
  const dupIssues = detectDuplicates(data);
  if (dupIssues.length > 0) {
    const [fixed, res] = applyDuplicates(data);
    data = fixed;
    if (res.rows_affected > 0) autoResults.push({ step_id: res.step_id, description: res.description, rows_affected: res.rows_affected });
  }

  // Auto-fix: whitespace
  const wsIssues = detectWhitespace(data);
  if (wsIssues.length > 0) {
    const [fixed, res] = applyWhitespace(data);
    data = fixed;
    if (res.rows_affected > 0) autoResults.push({ step_id: res.step_id, description: res.description, rows_affected: res.rows_affected });
  }

  // Medium: numeric as text
  for (const issue of detectNumericAsText(data)) {
    mediumIssues.push({
      step_id: issue.step_id, title: issue.title, description: issue.description,
      affected: issue.affected, examples: issue.examples, fix_description: issue.fix_description, risk: issue.risk,
    });
  }

  // Medium: null filler
  for (const issue of detectNullFiller(data)) {
    mediumIssues.push({
      step_id: issue.step_id, title: issue.title, description: issue.description,
      affected: issue.affected, examples: issue.examples, fix_description: issue.fix_description, risk: issue.risk,
    });
  }

  // Medium: date standardise
  for (const issue of detectDateStandardise(data)) {
    mediumIssues.push({
      step_id: issue.step_id, title: issue.title, description: issue.description,
      affected: issue.affected, examples: issue.examples, fix_description: issue.fix_description, risk: issue.risk,
    });
  }

  return [data, autoResults, mediumIssues];
}

export function applyDecisions(rows: ParsedRow[], approvedStepIds: string[]): [ParsedRow[], Record<string, any>[]] {
  let data = rows;
  const results: Record<string, any>[] = [];
  const approved = new Set(approvedStepIds);

  for (const stepId of approved) {
    if (stepId.startsWith('numeric_as_text__')) {
      const col = stepId.replace('numeric_as_text__', '');
      if (Object.keys(data[0] ?? {}).includes(col)) {
        const [fixed, res] = applyNumericAsText(data, col);
        data = fixed;
        results.push({ step_id: res.step_id, description: res.description, rows_affected: res.rows_affected });
      }
    } else if (stepId.startsWith('null_filler__')) {
      const col = stepId.replace('null_filler__', '');
      if (Object.keys(data[0] ?? {}).includes(col)) {
        const [fixed, res] = applyNullFiller(data, col);
        data = fixed;
        results.push({ step_id: res.step_id, description: res.description, rows_affected: res.rows_affected });
      }
    } else if (stepId.startsWith('date_standardise__')) {
      const col = stepId.replace('date_standardise__', '');
      if (Object.keys(data[0] ?? {}).includes(col)) {
        const [fixed, res] = applyDateStandardise(data, col);
        data = fixed;
        results.push({ step_id: res.step_id, description: res.description, rows_affected: res.rows_affected });
      }
    }
  }

  return [data, results];
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
