"""
Orchestrator Agent: Routes user questions to the appropriate specialist agents
and assembles the final response matching the API contract.
"""
import asyncio
import json
from app.utils.gemini_client import gemini
from app.agents.sql_agent import run_sql_agent
from app.agents.code_agent import run_code_agent
from app.agents.search_agent import run_search_agent, build_search_query
from app.agents.explain_agent import run_explain_agent
from app.core.confidence import calculate_confidence


CLASSIFY_SYSTEM_PROMPT = """You are a routing agent for a data analysis platform. Classify the user question into exactly one category.

Categories:
- "sql_query": Simple data retrieval — totals, counts, averages, filters, grouping, rankings, top/bottom N. SQL can answer this without Python.
- "visualization": Bar charts, line charts, pie charts, area charts of aggregated data. SQL + Recharts can render this.
- "statistical_analysis": Anything requiring Python/matplotlib — correlations, heatmaps, distributions, histograms, box plots, scatter plots with regression, pairplots, outlier detection, clustering, statistical tests, pivot tables, any chart that needs seaborn or matplotlib.
- "web_search": Questions about external news, trends, events, or industry context NOT in the data.
- "general": Greetings or meta-questions about the dataset or tool.

IMPORTANT routing rules:
- "correlation", "heatmap", "correlation matrix", "correlation analysis" → ALWAYS "statistical_analysis"
- "distribution", "histogram", "box plot", "violin plot" → ALWAYS "statistical_analysis"
- "scatter plot", "regression", "trend line", "pairplot", "pair plot" → ALWAYS "statistical_analysis"
- "matplotlib", "seaborn", "python analysis", "statistical" → ALWAYS "statistical_analysis"
- Simple "bar chart of X by Y", "line chart over time", "pie chart of categories" → "visualization"
- "total", "count", "average", "sum", "group by", "top N" → "sql_query"

Schema: {schema}
Semantic Layer: {semantic_layer}

Respond with ONLY a JSON object:
{{"category": "...", "needs_web_context": true/false, "search_query": "..." or null, "reasoning": "one sentence"}}
"""


def _get_combined_schema(session: dict) -> list:
    combined = []
    for table_name, meta in session.get("tables", {}).items():
        for col in meta.get("schema", []):
            combined.append({**col, "table": table_name})
    return combined


def _get_primary_df(session: dict):
    tables = session.get("tables", {})
    if not tables:
        return None
    return next(iter(tables.values()))["df"]


def _get_total_rows(session: dict) -> int:
    tables = session.get("tables", {})
    return sum(meta.get("df") is not None and len(meta["df"]) or 0 for meta in tables.values())


async def process_question(
    question: str,
    session: dict,
    options: dict = {},
) -> dict:
    """
    Main orchestrator: classify the question, route to agents, assemble response.

    options keys:
      include_chart        bool  (default True)
      include_web_search   bool  (default True) — legacy flag used by LLM-detected web need
      web_search           bool  (default False) — user-toggled parallel web enrichment
      mode                 str   "auto"|"sql"|"analysis"|"compliance" (default "auto")
      sensitive_columns    list  column names to block AI explanation for
    """
    schema = _get_combined_schema(session)
    semantic_layer = session.get("semantic_layer")
    include_chart = options.get("include_chart", True)
    include_web = options.get("include_web_search", True)
    web_search_toggle = options.get("web_search", False)   # user toggle
    sensitive_columns = options.get("sensitive_columns", [])
    mode = options.get("mode", "auto")
    total_rows = _get_total_rows(session)

    # Build conversation history from last 6 stored messages (3 Q&A pairs)
    raw_history = session.get("messages", [])[-6:]
    conversation_history = None
    if raw_history:
        lines = []
        for m in raw_history:
            role = "User" if m.get("role") == "user" else "Assistant"
            content = m.get("content") or m.get("answer", "")
            if content:
                lines.append(f"{role}: {str(content)[:400]}")
        if lines:
            conversation_history = "\n".join(lines)

    # Step 0: Compliance pre-screen (runs regardless of mode)
    from app.agents.compliance_agent import pre_screen, post_validate, answer_compliance_question
    block = pre_screen(question)
    if block:
        return block

    # Compliance mode: route entirely to compliance agent
    if mode == "compliance":
        return await answer_compliance_question(question, schema)

    # Step 1: Classify or override based on mode
    if mode == "auto":
        classification = await _classify_question(question, schema, semantic_layer, conversation_history)
        category = classification.get("category", "sql_query")
        needs_web = classification.get("needs_web_context", False) and include_web
        search_query_hint = classification.get("search_query")
    else:
        # Hard mode override — skip LLM classification entirely
        mode_to_category = {
            "sql": "sql_query",
            "analysis": "statistical_analysis",
        }
        category = mode_to_category.get(mode, "sql_query")
        needs_web = False
        search_query_hint = None
        classification = {}

    # Keyword override for statistical analysis (always wins)
    q_lower = question.lower()
    STATISTICAL_KEYWORDS = [
        "correlation", "heatmap", "distribution", "histogram",
        "box plot", "boxplot", "violin", "scatter", "regression",
        "pairplot", "pair plot", "outlier", "cluster", "clustering",
        "statistical", "statistics", "matplotlib", "seaborn",
        "std", "variance", "skew", "kurtosis", "covariance",
    ]
    if mode == "auto" and any(kw in q_lower for kw in STATISTICAL_KEYWORDS):
        category = "statistical_analysis"

    # Step 2: Route to primary agent + optionally parallel web search
    primary_coro = _run_primary_agent(question, session, category, include_chart, total_rows)

    if web_search_toggle:
        search_q = search_query_hint or build_search_query(question)
        web_coro = run_search_agent(query=search_q, max_results=5)
        primary_result, web_result = await asyncio.gather(primary_coro, web_coro)
        parallel_web_results = web_result.get("results", [])
    else:
        primary_result = await primary_coro
        parallel_web_results = []

    result = primary_result

    # Step 3: Legacy web context (LLM-flagged needs_web, not user-toggled)
    web_results = result.get("web_results", parallel_web_results)
    if needs_web and category != "web_search" and not web_search_toggle:
        try:
            sq = search_query_hint or build_search_query(question)
            search_result = await run_search_agent(query=sq, max_results=3)
            web_results = search_result.get("results", [])
        except Exception:
            web_results = []

    # Merge parallel web results
    if parallel_web_results and not web_results:
        web_results = parallel_web_results

    # Step 4: Sensitive column bypass
    has_sensitive_data = False
    if sensitive_columns and result.get("columns_used"):
        sensitive_lower = [c.lower() for c in sensitive_columns]
        for c in result["columns_used"]:
            if c.lower() in sensitive_lower:
                has_sensitive_data = True
                break

    if has_sensitive_data:
        answer = "⚠️ **Security Notice:** The results contain sensitive columns. AI-generated summary is not available for this query. You can view the direct result below."
    else:
        explanation_data = result.get("data", [])
        if result.get("stdout"):
            explanation_data = result["stdout"]
        # For web-search answers the primary data IS the web results
        if not explanation_data and web_results:
            explanation_data = web_results
        try:
            answer = await run_explain_agent(
                question=question,
                result_data=explanation_data,
                agent_type=result.get("agent_used", "unknown"),
                sql_query=result.get("sql_query"),
                python_code=result.get("python_code"),
                columns_used=result.get("columns_used", []),
                row_count=result.get("row_count", 0),
                total_rows=result.get("total_rows", 0),
                web_results=web_results if web_results else None,
                conversation_history=conversation_history,
            )
        except Exception as e:
            answer = result.get("stdout", f"Analysis complete. Error generating summary: {str(e)}")

    if category == "general" and result.get("answer"):
        answer = result["answer"]

    # Step 4b: Follow-up suggestions
    suggestions = [] if result.get("error") else await _suggest_followups(question, answer, schema)

    # Step 5: Compliance post-validate
    compliance_result = post_validate(question, result.get("data", []), schema)

    # Step 6: Confidence
    confidence = calculate_confidence(
        rows_used=result.get("row_count", 0),
        total_rows=result.get("total_rows", 0),
        columns_used=result.get("columns_used", []),
        schema=schema,
        question=question,
        web_results=web_results,
        sql_error=result.get("error"),
        compliance_status=compliance_result.get("status", "compliant"),
    )

    # Step 7: Sources
    sources = []
    if result.get("columns_used"):
        sources.append({
            "type": "column",
            "value": f"{', '.join(result['columns_used'])} ({result.get('row_count', 0):,} rows)",
        })
    if web_results:
        for wr in web_results[:3]:
            sources.append({
                "type": "web",
                "value": wr.get("title", "Web article"),
                "url": wr.get("url", ""),
            })

    return {
        "answer": answer,
        "agent_used": result.get("agent_used", "unknown"),
        "sql_query": result.get("sql_query"),
        "python_code": result.get("python_code"),
        "chart": result.get("chart"),
        "matplotlib_image": result.get("matplotlib_image"),
        "matplotlib_images": result.get("matplotlib_images"),
        "data": result.get("data", []),
        "confidence": confidence,
        "sources": sources,
        "suggestions": suggestions,
        "web_context": web_results,
        "compliance": compliance_result,
        "from_cache": False,
    }


async def _run_primary_agent(question, session, category, include_chart, total_rows) -> dict:
    """Route to the correct primary agent based on category."""
    if category == "general":
        return await _handle_general(question, _get_combined_schema(session))

    if category in ("sql_query", "visualization"):
        sql_result = await run_sql_agent(
            question=question,
            session=session,
            include_chart=include_chart or category == "visualization",
        )
        r = {
            "agent_used": "sql_agent",
            "sql_query": sql_result["sql_query"],
            "python_code": None,
            "chart": sql_result.get("chart"),
            "matplotlib_image": None,
            "data": sql_result.get("data", []),
            "columns_used": sql_result.get("columns_used", []),
            "row_count": sql_result.get("row_count", 0),
            "total_rows": sql_result.get("total_rows", total_rows),
            "error": sql_result.get("error"),
        }
        if r["chart"] and sql_result.get("data"):
            r["chart"]["data"] = sql_result["data"][:50]
        return r

    if category == "statistical_analysis":
        primary_df = _get_primary_df(session)
        session_with_df = {**session, "df": primary_df}
        code_result = await run_code_agent(question=question, session=session_with_df)
        primary_len = len(primary_df) if primary_df is not None else 0
        return {
            "agent_used": "code_agent",
            "sql_query": None,
            "python_code": code_result.get("python_code"),
            "chart": None,
            "matplotlib_image": (
                code_result["matplotlib_images"][0] if code_result.get("matplotlib_images") else None
            ),
            "matplotlib_images": code_result.get("matplotlib_images", []),
            "data": [],
            "columns_used": [],
            "row_count": primary_len,
            "total_rows": total_rows,
            "error": code_result.get("error"),
            "stdout": code_result.get("stdout", ""),
        }

    if category == "web_search":
        search_result = await run_search_agent(query=build_search_query(question))
        return {
            "agent_used": "search_agent",
            "sql_query": None,
            "python_code": None,
            "chart": None,
            "matplotlib_image": None,
            "data": [],
            "columns_used": [],
            "row_count": 0,
            "total_rows": total_rows,
            "web_results": search_result.get("results", []),
        }

    # Default: SQL
    sql_result = await run_sql_agent(question=question, session=session, include_chart=include_chart)
    return {
        "agent_used": "sql_agent",
        "sql_query": sql_result["sql_query"],
        "python_code": None,
        "chart": sql_result.get("chart"),
        "matplotlib_image": None,
        "data": sql_result.get("data", []),
        "columns_used": sql_result.get("columns_used", []),
        "row_count": sql_result.get("row_count", 0),
        "total_rows": sql_result.get("total_rows", total_rows),
        "error": sql_result.get("error"),
    }


async def _suggest_followups(question: str, answer: str, schema: list) -> list[str]:
    col_names = ", ".join(f"{s.get('table','')}.{s['name']}" for s in schema[:20])
    prompt = (
        f"A user asked: \"{question}\"\n"
        f"The answer was: \"{answer[:300]}\"\n"
        f"Available columns: {col_names}\n\n"
        f"Suggest exactly 3 short follow-up questions a business user might ask next. "
        f"Each question should be different and explore a new angle. "
        f"Respond ONLY as JSON: {{\"suggestions\": [\"...\", \"...\", \"...\"]}}"
    )
    try:
        result = await gemini.generate_json(prompt=prompt, temperature=0.4)
        suggestions = result.get("suggestions", [])
        return [s for s in suggestions if isinstance(s, str)][:3]
    except Exception:
        return []


async def _classify_question(question: str, schema: list, semantic_layer, conversation_history: str | None = None) -> dict:
    schema_summary = json.dumps(
        [{"name": s["name"], "type": s["type"], "table": s.get("table", "")} for s in schema],
        indent=2,
    )
    semantic_str = semantic_layer.to_json() if semantic_layer else "None"
    system_prompt = CLASSIFY_SYSTEM_PROMPT.format(schema=schema_summary, semantic_layer=semantic_str)
    prompt_parts = []
    if conversation_history:
        prompt_parts.append(f"Conversation so far:\n{conversation_history}\n")
    prompt_parts.append(f"User question: {question}")
    try:
        result = await gemini.generate_json(
            prompt="\n".join(prompt_parts),
            system_instruction=system_prompt,
            temperature=0.1,
        )
        return result
    except Exception:
        return {"category": "sql_query", "needs_web_context": False, "search_query": None}


async def _handle_general(question: str, schema: list) -> dict:
    question_lower = question.lower().strip()
    dataset_description_keywords = [
        "about","describe","overview","summary","tell me","what is this",
        "what kind","what type","what does","what data","what columns",
        "column","schema","fields","variables","contain","have in it","csv","dataset","file",
    ]
    greetings = ["hello","hi","hey","what can you do"]
    is_greeting = any(g in question_lower for g in greetings)
    is_dataset_question = any(k in question_lower for k in dataset_description_keywords)

    if is_dataset_question or is_greeting:
        numeric_cols = [s for s in schema if s["type"] in ("INTEGER","REAL","FLOAT","NUMERIC")]
        text_cols   = [s for s in schema if s["type"] == "TEXT"]
        date_cols   = [s for s in schema if s["type"] in ("DATE","TIMESTAMP","DATETIME")]
        bool_cols   = [s for s in schema if s["type"] == "BOOLEAN"]
        bad_cols    = [s for s in schema if s.get("missing_pct", 0) > 20]

        groups = []
        if text_cols:
            groups.append(f"**Labels & categories** — {', '.join(c['name'] for c in text_cols[:6])}"
                          + (f" + {len(text_cols)-6} more" if len(text_cols) > 6 else ""))
        if numeric_cols:
            groups.append(f"**Numbers & measurements** — {', '.join(c['name'] for c in numeric_cols[:5])}"
                          + (f" + {len(numeric_cols)-5} more" if len(numeric_cols) > 5 else ""))
        if date_cols:
            groups.append(f"**Dates & timestamps** — {', '.join(c['name'] for c in date_cols)}")
        if bool_cols:
            groups.append(f"**Yes/No flags** — {', '.join(c['name'] for c in bool_cols)}")

        groups_md = "\n".join(f"- {g}" for g in groups)
        quality_md = ""
        if bad_cols:
            quality_md = "\n\n**Data quality heads-up:**\n" + "\n".join(
                f"- **{c['name']}** has {c['missing_pct']:.0f}% missing values — treat with caution"
                for c in bad_cols[:4]
            )

        examples = []
        if numeric_cols and text_cols:
            examples.append(f'"What is the total {numeric_cols[0]["name"]} by {text_cols[0]["name"]}?"')
        if date_cols and numeric_cols:
            examples.append(f'"Show {numeric_cols[0]["name"]} trends over time as a line chart"')
        if len(numeric_cols) >= 2:
            examples.append(f'"Run a correlation analysis on {numeric_cols[0]["name"]} and {numeric_cols[1]["name"]}"')
        if text_cols:
            examples.append(f'"What are the top 10 {text_cols[0]["name"]} by count?"')

        examples_md = "\n".join(f"- {e}" for e in examples[:4])
        greeting = "Hello! I'm DataTalk — ask me anything about your data.\n\n" if is_greeting else ""

        from collections import defaultdict
        by_table = defaultdict(list)
        for col in schema:
            by_table[col.get("table","")].append(col["name"])
        table_summary = ""
        if len(by_table) > 1:
            table_lines = "\n".join(
                f"- **{t}**: {', '.join(cols[:5])}" + (f" + {len(cols)-5} more" if len(cols) > 5 else "")
                for t, cols in by_table.items()
            )
            table_summary = f"\n\n**Loaded tables:**\n{table_lines}"

        answer = (
            f"{greeting}## Your dataset at a glance\n\n"
            f"It contains **{len(schema)} columns** of information:{table_summary}\n\n"
            f"{groups_md}{quality_md}\n\n---\n\n"
            f"**Here are some things you can ask:**\n\n{examples_md}"
        )
    else:
        answer = (
            "I can help you explore your dataset. Try asking:\n\n"
            "- \"What is this dataset about?\"\n"
            "- \"Show me a chart of the top categories\"\n"
            "- \"What are the top 10 records by value?\""
        )

    return {
        "agent_used": "general",
        "sql_query": None, "python_code": None, "chart": None,
        "matplotlib_image": None, "data": [], "columns_used": [],
        "row_count": 0, "total_rows": 0, "answer": answer,
    }
