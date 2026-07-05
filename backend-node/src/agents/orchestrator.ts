/**
 * Orchestrator Agent
 */
import { gemini } from '../utils/geminiClient';
import { runSqlAgent } from './sqlAgent';
import { runCodeAgent } from './codeAgent';
import { runSearchAgent, buildSearchQuery } from './searchAgent';
import { runExplainAgent } from './explainAgent';
import { checkPiiQuery } from '../core/complianceRules';

import { Session, ColumnSchema, ChatResponse, ParsedRow, WebResult } from '../types';

const CLASSIFY_SYSTEM_PROMPT = `You are a routing agent for a data analysis platform. Classify the user question into exactly one category.

Categories:
- "sql_query": Simple data retrieval — totals, counts, averages, filters, grouping, rankings, top/bottom N.
- "visualization": Bar charts, line charts, pie charts, area charts of aggregated data.
- "statistical_analysis": Anything requiring Python/matplotlib — correlations, heatmaps, distributions, histograms, box plots, scatter plots with regression, pairplots, outlier detection, clustering, statistical tests, pivot tables.
- "web_search": Questions about external news, trends, events, or industry context NOT in the data.
- "general": Greetings or meta-questions about the dataset or tool.

IMPORTANT routing rules:
- "correlation", "heatmap", "correlation matrix" → ALWAYS "statistical_analysis"
- "distribution", "histogram", "box plot", "violin plot" → ALWAYS "statistical_analysis"
- "scatter plot", "regression", "trend line", "pairplot" → ALWAYS "statistical_analysis"
- Simple "bar chart of X by Y", "line chart over time", "pie chart of categories" → "visualization"
- "total", "count", "average", "sum", "group by", "top N" → "sql_query"

Schema: {schema}

Respond with ONLY a JSON object:
{"category": "...", "needs_web_context": true/false, "search_query": "..." or null, "reasoning": "one sentence"}`;

function getCombinedSchema(session: Session): ColumnSchema[] {
  return Object.entries(session.tables ?? {}).flatMap(([table, meta]) =>
    meta.schema.map((c) => ({ ...c, table })),
  );
}

function getPrimaryRows(session: Session): ParsedRow[] {
  const tables = session.tables ?? {};
  const first = Object.values(tables)[0];
  return first?.rows ?? [];
}

function getTotalRows(session: Session): number {
  return Object.values(session.tables ?? {}).reduce((s, t) => s + t.rows.length, 0);
}

async function classifyQuestion(
  question: string,
  schema: ColumnSchema[],
  conversationHistory: string | null,
): Promise<Record<string, any>> {
  const schemaSummary = JSON.stringify(schema.map((s) => ({ name: s.name, type: s.type, table: (s as any).table ?? '' })), null, 2);
  const systemPrompt = CLASSIFY_SYSTEM_PROMPT
    .replace('{schema}', schemaSummary);
  const parts: string[] = [];
  if (conversationHistory) parts.push(`Conversation so far:\n${conversationHistory}\n`);
  parts.push(`User question: ${question}`);
  try {
    return await gemini.generateJson({ prompt: parts.join('\n'), system_instruction: systemPrompt, temperature: 0.1 });
  } catch {
    return { category: 'sql_query', needs_web_context: false, search_query: null };
  }
}

async function suggestFollowups(question: string, answer: string, schema: ColumnSchema[]): Promise<string[]> {
  const colNames = schema.slice(0, 20).map((s) => `${(s as any).table ?? ''}.${s.name}`).join(', ');
  const prompt = `A user asked: "${question}"\nThe answer was: "${answer.slice(0, 300)}"\nAvailable columns: ${colNames}\n\nSuggest exactly 3 short follow-up questions a business user might ask next. Respond ONLY as JSON: {"suggestions": ["...", "...", "..."]}`;
  try {
    const result = await gemini.generateJson({ prompt, temperature: 0.4 });
    return (result.suggestions as string[]).filter((s) => typeof s === 'string').slice(0, 3);
  } catch {
    return [];
  }
}

async function handleGeneral(question: string, schema: ColumnSchema[]): Promise<Partial<ChatResponse>> {
  const qLower = question.toLowerCase().trim();
  const datasetKw = ['about','describe','overview','summary','tell me','what is this','column','schema','fields','contain','dataset','file'];
  const greetings = ['hello','hi','hey','what can you do'];
  const isGreeting = greetings.some((g) => qLower.includes(g));
  const isDataset = datasetKw.some((k) => qLower.includes(k));

  if (!isDataset && !isGreeting) {
    return { agent_used: 'general', sql_query: null, python_code: null, chart: null, matplotlib_image: null, data: [], columns_used: [], row_count: 0, total_rows: 0, answer: 'I can help you explore your dataset. Try asking: "What is this dataset about?"' };
  }

  const numeric = schema.filter((s) => ['INTEGER','REAL'].includes(s.type));
  const text = schema.filter((s) => s.type === 'TEXT');
  const dates = schema.filter((s) => ['DATETIME'].includes(s.type));

  const groups: string[] = [];
  if (text.length) groups.push(`**Labels & categories** — ${text.slice(0, 6).map((c) => c.name).join(', ')}`);
  if (numeric.length) groups.push(`**Numbers & measurements** — ${numeric.slice(0, 5).map((c) => c.name).join(', ')}`);
  if (dates.length) groups.push(`**Dates & timestamps** — ${dates.map((c) => c.name).join(', ')}`);

  const examples: string[] = [];
  if (numeric.length && text.length) examples.push(`"What is the total ${numeric[0].name} by ${text[0].name}?"`);
  if (dates.length && numeric.length) examples.push(`"Show ${numeric[0].name} trends over time as a line chart"`);
  if (numeric.length >= 2) examples.push(`"Run a correlation analysis on ${numeric[0].name} and ${numeric[1].name}"`);
  if (text.length) examples.push(`"What are the top 10 ${text[0].name} by count?"`);

  const greeting = isGreeting ? "Hello! I'm DataTalk — ask me anything about your data.\n\n" : '';
  const answer = `${greeting}## Your dataset at a glance\n\nIt contains **${schema.length} columns** of information:\n\n${groups.map((g) => `- ${g}`).join('\n')}\n\n---\n\n**Here are some things you can ask:**\n\n${examples.slice(0, 4).map((e) => `- ${e}`).join('\n')}`;

  return { agent_used: 'general', sql_query: null, python_code: null, chart: null, matplotlib_image: null, data: [], columns_used: [], row_count: 0, total_rows: 0, answer };
}

async function runPrimaryAgent(
  question: string, session: Session, category: string, includeChart: boolean, totalRows: number,
): Promise<Record<string, any>> {
  if (category === 'general') {
    return await handleGeneral(question, getCombinedSchema(session));
  }

  if (category === 'sql_query' || category === 'visualization') {
    const r = await runSqlAgent({ question, session, include_chart: includeChart || category === 'visualization' });
    const out: Record<string, any> = { agent_used: 'sql_agent', sql_query: r.sql_query, python_code: null, chart: r.chart, matplotlib_image: null, data: r.data, columns_used: r.columns_used, row_count: r.row_count, total_rows: r.total_rows, error: r.error };
    if (out.chart && r.data) out.chart.data = r.data.slice(0, 50);
    return out;
  }

  if (category === 'statistical_analysis') {
    const r = await runCodeAgent({ question, session });
    const len = getPrimaryRows(session).length;
    return {
      agent_used: 'code_agent', sql_query: null, python_code: r.python_code, chart: null,
      matplotlib_image: r.matplotlib_images[0] ?? null, matplotlib_images: r.matplotlib_images,
      data: [], columns_used: [], row_count: len, total_rows: totalRows, error: r.error, stdout: r.stdout,
    };
  }

  if (category === 'web_search') {
    const r = await runSearchAgent({ query: buildSearchQuery(question) });
    return { agent_used: 'search_agent', sql_query: null, python_code: null, chart: null, matplotlib_image: null, data: [], columns_used: [], row_count: 0, total_rows: totalRows, web_results: r.results };
  }

  // Default: SQL
  const r = await runSqlAgent({ question, session, include_chart: includeChart });
  return { agent_used: 'sql_agent', sql_query: r.sql_query, python_code: null, chart: r.chart, matplotlib_image: null, data: r.data, columns_used: r.columns_used, row_count: r.row_count, total_rows: r.total_rows, error: r.error };
}

const STATISTICAL_KEYWORDS = ['correlation','heatmap','distribution','histogram','box plot','boxplot','violin','scatter','regression','pairplot','pair plot','outlier','cluster','clustering','statistical','statistics','matplotlib','seaborn','std','variance','skew','kurtosis','covariance'];

export async function processQuestion(
  question: string,
  session: Session,
  options: Record<string, any> = {},
): Promise<ChatResponse> {
  const schema = getCombinedSchema(session);
  const includeChart = options.include_chart !== false;
  const includeWeb = options.include_web_search !== false;
  const webSearchToggle = options.web_search === true;
  const sensitiveColumns: string[] = options.sensitive_columns ?? [];
  const mode: string = options.mode ?? 'auto';
  const totalRows = getTotalRows(session);

  const rawHistory = (session.messages ?? []).slice(-6);
  let conversationHistory: string | null = null;
  if (rawHistory.length) {
    const lines = rawHistory.map((m) => {
      const role = m.role === 'user' ? 'User' : 'Assistant';
      const content = (m.content || m.answer || '').slice(0, 400);
      return content ? `${role}: ${content}` : null;
    }).filter(Boolean) as string[];
    if (lines.length) conversationHistory = lines.join('\n');
  }

  // Step 0: PII pre-screen
  const block = checkPiiQuery(question);
  if (block) {
    return {
      answer: `🔴 **${block.message}**`,
      agent_used: 'compliance_agent',
      sql_query: null, python_code: null, chart: null, matplotlib_image: null,
      data: [],
      sources: [], suggestions: [], web_context: [], from_cache: false,
    };
  }

  // Step 1: Classify or override
  let category: string;
  let needsWeb = false;
  let searchQueryHint: string | null = null;

  if (mode === 'auto') {
    const cls = await classifyQuestion(question, schema, conversationHistory);
    category = cls.category ?? 'sql_query';
    needsWeb = (cls.needs_web_context === true) && includeWeb;
    searchQueryHint = cls.search_query ?? null;
  } else {
    const modeMap: Record<string, string> = { sql: 'sql_query', analysis: 'statistical_analysis' };
    category = modeMap[mode] ?? 'sql_query';
  }

  // Keyword override
  const qLower = question.toLowerCase();
  if (mode === 'auto' && STATISTICAL_KEYWORDS.some((kw) => qLower.includes(kw))) {
    category = 'statistical_analysis';
  }

  // Step 2: Run primary agent (+ optional parallel web search)
  let primaryResult: Record<string, any>;
  let parallelWebResults: WebResult[] = [];

  if (webSearchToggle) {
    const sq = searchQueryHint ?? buildSearchQuery(question);
    const [primary, web] = await Promise.all([
      runPrimaryAgent(question, session, category, includeChart, totalRows),
      runSearchAgent({ query: sq, max_results: 5 }),
    ]);
    primaryResult = primary;
    parallelWebResults = web.results;
  } else {
    primaryResult = await runPrimaryAgent(question, session, category, includeChart, totalRows);
  }

  const result = primaryResult;

  // Step 3: Legacy web context (LLM-flagged, not user-toggled)
  let webResults: WebResult[] = result.web_results ?? parallelWebResults;
  if (needsWeb && category !== 'web_search' && !webSearchToggle) {
    try {
      const sq = searchQueryHint ?? buildSearchQuery(question);
      const sr = await runSearchAgent({ query: sq, max_results: 3 });
      webResults = sr.results;
    } catch { /* ignore */ }
  }
  if (parallelWebResults.length && !webResults.length) webResults = parallelWebResults;

  // Step 4: Sensitive column bypass
  const hasSensitiveData = sensitiveColumns.length > 0 && result.columns_used?.some(
    (c: string) => sensitiveColumns.map((s: string) => s.toLowerCase()).includes(c.toLowerCase()),
  );

  let answer: string;
  if (hasSensitiveData) {
    answer = '⚠️ **Security Notice:** The results contain sensitive columns. AI-generated summary is not available for this query.';
  } else {
    const explainData = result.data?.length ? result.data : result.stdout ? result.stdout : webResults.length ? webResults : [];
    try {
      answer = await runExplainAgent({
        question, result_data: explainData, agent_type: result.agent_used ?? 'unknown',
        sql_query: result.sql_query, python_code: result.python_code,
        columns_used: result.columns_used ?? [], row_count: result.row_count ?? 0,
        total_rows: result.total_rows ?? 0, web_results: webResults.length ? webResults : null,
        error: result.error, conversation_history: conversationHistory,
      });
    } catch (e: any) {
      answer = result.stdout ?? `Analysis complete. Error generating summary: ${e.message}`;
    }
  }

  if (category === 'general' && result.answer) answer = result.answer as string;

  const suggestions = result.error ? [] : await suggestFollowups(question, answer, schema);

  const sources: ChatResponse['sources'] = [];
  if (result.columns_used?.length) {
    sources.push({ type: 'column', value: `${result.columns_used.join(', ')} (${(result.row_count ?? 0).toLocaleString()} rows)` });
  }
  for (const wr of webResults.slice(0, 3)) {
    sources.push({ type: 'web', value: wr.title, url: wr.url });
  }

  return {
    answer, agent_used: result.agent_used ?? 'unknown',
    sql_query: result.sql_query ?? null, python_code: result.python_code ?? null,
    chart: result.chart ?? null, matplotlib_image: result.matplotlib_image ?? null,
    matplotlib_images: result.matplotlib_images ?? [],
    data: result.data ?? [], sources, suggestions,
    web_context: webResults, from_cache: false,
  };
}
