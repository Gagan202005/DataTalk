/**
 * SQL Agent
 */
import { gemini } from '../utils/geminiClient';
import { Session, ParsedRow, ChartSpec, ColumnSchema } from '../types';

const SQL_SYSTEM_PROMPT = `You are a DuckDB SQL expert. Given this database schema and metric definitions, generate ONLY a valid DuckDB SQL query.

Rules:
1. ONLY reference columns that exist in the schema below.
3. Always include meaningful aliases with AS.
4. For time-series: ORDER BY the date/time column.
5. For comparisons: include all relevant grouping columns.
6. Use the exact table names listed in the schema — multiple tables may be available.
7. For date filtering use standard SQL: WHERE date_column >= '2024-01-01'.
8. Output ONLY the raw SQL query — no markdown, no explanation, no backticks, no code fences.
9. If the question cannot be answered with the given schema, return: SELECT 'CANNOT_ANSWER' as error;
10. DuckDB supports STRFTIME, DATE_TRUNC, DATE_DIFF, and standard window functions.

CRITICAL — GRAPHS AND AGGREGATIONS:
11. When the user asks for a graph, chart, plot, or visualization — ALWAYS aggregate with GROUP BY + COUNT(*) or SUM/AVG. NEVER select individual rows for a chart.
12. For "X vs Y graph" or "X by Y": GROUP BY the categorical/time column and aggregate the numeric dimension.
13. For time-based charts: use STRFTIME('%Y', date_col) AS year, GROUP BY it, COUNT(*) or SUM. ORDER BY the time column.
14. Aggregation queries (GROUP BY) must NOT have a LIMIT unless the user explicitly asks for "top N".
15. Only use LIMIT 100 for raw record lookups where no GROUP BY is present.
16. When a question involves columns from different tables, use JOIN on columns with the same name.`;

const CHART_SYSTEM_PROMPT = `Based on this SQL query and its results, recommend a chart type and data mapping.

Respond with ONLY a JSON object:
{
    "should_chart": true/false,
    "chart_type": "bar" | "line" | "pie" | "scatter" | "area",
    "x_key": "column_name_for_x_axis",
    "y_key": "column_name_for_y_axis",
    "title": "Chart Title"
}

Rules:
- "bar": for comparing categories
- "line": for time series / trends
- "pie": for proportions (max 8 slices)
- "scatter": for correlations between two numeric columns
- "area": for cumulative / stacked time series
- If results have <= 1 row or are not visual, set should_chart to false`;

function buildSchemaStr(session: Session): string {
  const tables = session.tables ?? {};
  return Object.entries(tables)
    .map(([name, meta]) => {
      const cols = meta.schema.map((c) => `${c.name} (${c.type})`).join(', ');
      return `Table '${name}': ${cols}`;
    })
    .join('\n');
}

function getAllSchemaCols(session: Session): ColumnSchema[] {
  return Object.values(session.tables ?? {}).flatMap((t) => t.schema);
}

function cleanSql(sql: string): string {
  sql = sql.trim().replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim().replace(/;+$/, '').trim();
  return sql + ';';
}

async function recommendChart(
  sql: string,
  sampleData: ParsedRow[],
  columns: string[],
): Promise<ChartSpec | null> {
  const prompt = `SQL query: ${sql}\n\nResult columns: ${JSON.stringify(columns)}\nSample data: ${JSON.stringify(sampleData.slice(0, 5))}`;
  const result = await gemini.generateJson({ prompt, system_instruction: CHART_SYSTEM_PROMPT, temperature: 0.1 });
  if (!result.should_chart) return null;

  let xKey = result.x_key ?? columns[0];
  let yKey = result.y_key ?? columns[1] ?? columns[0];

  if (sampleData.length > 0) {
    const available = Object.keys(sampleData[0]);
    if (!available.includes(xKey)) xKey = available[0];
    if (!available.includes(yKey)) yKey = available[1] ?? available[0];
  }

  return { type: result.chart_type ?? 'bar', data: sampleData, x_key: xKey, y_key: yKey, title: result.title ?? 'Chart' };
}

function extractColumnsFromSql(sql: string, schema: ColumnSchema[]): string[] {
  const sqlLower = sql.toLowerCase();
  return schema
    .filter((c) => new RegExp(`\\b${c.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(sqlLower))
    .map((c) => c.name);
}

export async function runSqlAgent(opts: {
  question: string;
  session: Session;
  include_chart?: boolean;
}): Promise<{
  sql_query: string;
  data: ParsedRow[];
  chart: ChartSpec | null;
  columns_used: string[];
  row_count: number;
  total_rows: number;
  error?: string;
}> {
  const { question, session, include_chart = true } = opts;
  const db = session.db!;
  const schemaStr = buildSchemaStr(session);
  const allCols = getAllSchemaCols(session);
  const fullSystem = SQL_SYSTEM_PROMPT + `\n\nSchema:\n${schemaStr}`;

  let sqlQuery = await gemini.generate({ prompt: `User question: ${question}`, system_instruction: fullSystem, temperature: 0.1 });
  sqlQuery = cleanSql(sqlQuery);

  let result = await db.executeQuery(sqlQuery);

  if (!result.success) {
    sqlQuery = cleanSql(await gemini.generate({
      prompt: `The following SQL query failed:\n${sqlQuery}\n\nError: ${result.error}\n\nFix the SQL query. Use only the exact table names and columns from the schema. Output ONLY the fixed SQL.`,
      system_instruction: fullSystem, temperature: 0.1,
    }));
    result = await db.executeQuery(sqlQuery);

    if (!result.success) {
      sqlQuery = cleanSql(await gemini.generate({
        prompt: `SQL still failing:\n${sqlQuery}\n\nError: ${result.error}\n\nWrite a simpler query using basic SELECT, WHERE, GROUP BY. Output ONLY SQL.`,
        system_instruction: fullSystem, temperature: 0.2,
      }));
      result = await db.executeQuery(sqlQuery);
    }
  }

  const totalRows = await Promise.all(
    Object.keys(session.tables ?? {}).map((t) => db.getTableRowCount(t)),
  ).then((counts) => counts.reduce((a, b) => a + b, 0));

  if (!result.success) {
    return { sql_query: sqlQuery, data: [], chart: null, columns_used: [], row_count: 0, total_rows: totalRows, error: `Could not execute query: ${result.error}` };
  }

  if (result.data.length === 1 && (result.data[0] as any)?.error === 'CANNOT_ANSWER') {
    return { sql_query: sqlQuery, data: [], chart: null, columns_used: [], row_count: 0, total_rows: totalRows, error: 'This question cannot be answered with the available data columns.' };
  }

  let chart: ChartSpec | null = null;
  if (include_chart && result.data.length > 1) {
    try { chart = await recommendChart(sqlQuery, result.data.slice(0, 10), result.columns); } catch { /* ignore */ }
  }

  const columnsUsed = extractColumnsFromSql(sqlQuery, allCols);

  return { sql_query: sqlQuery, data: result.data, chart, columns_used: columnsUsed, row_count: result.row_count, total_rows: totalRows };
}
