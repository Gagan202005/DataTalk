/**
 * Explain Agent
 */
import { gemini } from '../utils/geminiClient';
import { WebResult } from '../types';

const EXPLAIN_SYSTEM_PROMPT = `You are a knowledgeable analyst answering a business user's question.

{conversation_history}
Context:
- User asked: {question}
- Agent used: {agent_type}
- SQL query (if any): {sql_query}
- Python code (if any): {python_code_summary}
- Columns analysed: {columns_used}
- Rows analysed: {row_count} of {total_rows} total rows
- Web search results (if any): {web_results}
- Error (if any): {error}

Rules:
1. Start with the DIRECT answer in bold in the first line.
2. Use bullet points for each key insight — maximum 5 bullets.
3. NO SQL, NO Python code, NO technical jargon.
4. Mention specific numbers and percentages — be precise.
5. If there is an error, explain in plain English what went wrong and suggest what the user could try.
6. IMPORTANT — If agent_type is "search_agent": web search results ARE your primary source. Extract actual answers with numbers and dates. Do NOT say you cannot find info if results are provided.
7. If web search results supplement dataset analysis, cite them with source title.
8. If the conversation history shows prior questions, use that context for coherent follow-up answers.
9. If there's a notable outlier or trend, highlight it as a separate bullet.
10. End with one sentence starting with "**Recommendation:**" if relevant.
11. Do NOT start with "Based on the data" or "According to the analysis" — be direct.
12. Format as clean markdown. Use **bold** for key numbers and findings.`;

export async function runExplainAgent(opts: {
  question: string;
  result_data: Record<string, any>[] | string;
  agent_type?: string;
  sql_query?: string | null;
  python_code?: string | null;
  columns_used?: string[];
  row_count?: number;
  total_rows?: number;
  web_results?: WebResult[] | null;
  error?: string | null;
  conversation_history?: string | null;
}): Promise<string> {
  const {
    question, result_data, agent_type = 'sql_agent', sql_query = null,
    python_code = null, columns_used = [], row_count = 0, total_rows = 0,
    web_results = null, error = null, conversation_history = null,
  } = opts;

  const webStr = web_results?.length
    ? web_results.slice(0, 5).map((r) => `- [${r.title}](${r.url}): ${r.snippet.slice(0, 300)}`).join('\n')
    : 'None';

  const resultStr = Array.isArray(result_data)
    ? JSON.stringify(result_data.slice(0, 20), null, 2)
    : String(result_data).slice(0, 3000);

  const codeSummary = python_code
    ? python_code.slice(0, 800) + (python_code.length > 800 ? '...' : '')
    : 'N/A';

  const historyBlock = conversation_history ? `Conversation so far:\n${conversation_history}\n\n` : '';

  const systemPrompt = EXPLAIN_SYSTEM_PROMPT
    .replace('{conversation_history}', historyBlock)
    .replace('{question}', question)
    .replace('{agent_type}', agent_type)
    .replace('{sql_query}', sql_query ?? 'N/A')
    .replace('{python_code_summary}', codeSummary)
    .replace('{columns_used}', columns_used.join(', ') || 'N/A')
    .replace('{row_count}', row_count.toLocaleString())
    .replace('{total_rows}', total_rows.toLocaleString())
    .replace('{web_results}', webStr)
    .replace('{error}', error ?? 'None');

  return gemini.generate({ prompt: `Analysis result:\n${resultStr}`, system_instruction: systemPrompt, temperature: 0.3 });
}
