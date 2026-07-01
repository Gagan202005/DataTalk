"""
Explain Agent: Takes raw results and produces plain English explanations.
Always runs last in the pipeline.

Key fix: now accepts an `error` parameter so it can provide a useful
explanation even when a query partially failed.
"""
import json
from app.utils.gemini_client import gemini


EXPLAIN_SYSTEM_PROMPT = """You are a knowledgeable analyst answering a business user's question.

{conversation_history}
Context:
- User asked: {question}
- Agent used: {agent_type}
- SQL query (if any): {sql_query}
- Python code (if any): {python_code_summary}
- Columns analysed: {columns_used}
- Rows analysed: {row_count:,} of {total_rows:,} total rows
- Web search results (if any): {web_results}
- Error (if any): {error}

Rules:
1. Start with the DIRECT answer in bold in the first line. Lead with the key finding.
2. Use bullet points for each key insight — maximum 5 bullets.
3. NO SQL, NO Python code, NO technical jargon whatsoever.
4. Mention specific numbers and percentages — be precise.
5. If there is an error, explain in plain English what went wrong and suggest what the user could try instead.
6. IMPORTANT — If agent_type is "search_agent": the web search results ARE your primary source. Extract the actual answer directly from those results with specific details, numbers, and dates. Do NOT say you cannot find the information if results are provided.
7. If web search results supplement dataset analysis, cite them with a source title.
8. If the conversation history shows prior questions, use that context to give a coherent follow-up answer.
9. If there's a notable outlier or trend, highlight it as a separate bullet.
10. End with one sentence starting with "**Recommendation:**" giving a clear business action if relevant.
11. Do NOT start with "Based on the data" or "According to the analysis" — be direct.
12. Format as clean markdown. Use **bold** for key numbers and findings.
"""


async def run_explain_agent(
    question: str,
    result_data: list | str,
    agent_type: str = "sql_agent",
    sql_query: str | None = None,
    python_code: str | None = None,
    columns_used: list[str] | None = None,
    row_count: int = 0,
    total_rows: int = 0,
    web_results: list[dict] | None = None,
    error: str | None = None,
    conversation_history: str | None = None,
) -> str:
    """
    Generate a plain English explanation of the analysis results.

    Returns:
        Plain English explanation string.
    """
    # Format web results — use full snippets so LLM has enough detail to extract numbers
    web_str = "None"
    if web_results:
        items = []
        for r in web_results[:5]:
            title = r.get('title', 'Article')
            snippet = str(r.get('snippet', '') or r.get('body', ''))[:300]
            url = r.get('url', '')
            items.append(f"- [{title}]({url}): {snippet}")
        web_str = "\n".join(items)

    # Format result data (truncate if very long)
    if isinstance(result_data, list):
        result_str = json.dumps(result_data[:20], indent=2, default=str)
    else:
        result_str = str(result_data)[:3000]

    # Send first 800 chars of python code so LLM knows what was computed
    code_summary = "N/A"
    if python_code:
        code_summary = python_code[:800] + ("..." if len(python_code) > 800 else "")

    history_block = ""
    if conversation_history:
        history_block = f"Conversation so far:\n{conversation_history}\n\n"

    system_prompt = EXPLAIN_SYSTEM_PROMPT.format(
        conversation_history=history_block,
        question=question,
        agent_type=agent_type,
        sql_query=sql_query or "N/A",
        python_code_summary=code_summary,
        columns_used=", ".join(columns_used) if columns_used else "N/A",
        row_count=row_count,
        total_rows=total_rows,
        web_results=web_str,
        error=error or "None",
    )

    explanation = await gemini.generate(
        prompt=f"Analysis result:\n{result_str}",
        system_instruction=system_prompt,
        temperature=0.3,
    )

    return explanation
