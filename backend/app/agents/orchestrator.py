"""
Orchestrator Agent: Routes user questions to the appropriate specialist agents
and assembles the final response matching the API contract.

This is THE BRAIN of DataTalk.
"""
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
    """Return flat list of all columns across all tables (with table field added)."""
    combined = []
    for table_name, meta in session.get("tables", {}).items():
        for col in meta.get("schema", []):
            combined.append({**col, "table": table_name})
    return combined


def _get_primary_df(session: dict):
    """Return the first table's DataFrame (used by code_agent)."""
    tables = session.get("tables", {})
    if not tables:
        return None
    return next(iter(tables.values()))["df"]


def _get_total_rows(session: dict) -> int:
    """Sum row counts across all tables."""
    tables = session.get("tables", {})
    return sum(meta.get("df") is not None and len(meta["df"]) or 0 for meta in tables.values())


async def process_question(
    question: str,
    session: dict,
    options: dict = {},
) -> dict:
    """
    Main orchestrator: classify the question, route to agents, assemble response.

    Args:
        question: User's natural language question.
        session: Session dict with db, tables, semantic_layer.
        options: Optional settings (include_chart, include_web_search).

    Returns:
        Complete response dict matching the API contract.
    """
    schema = _get_combined_schema(session)
    semantic_layer = session.get("semantic_layer")
    include_chart = options.get("include_chart", True)
    include_web = options.get("include_web_search", True)
    sensitive_columns = options.get("sensitive_columns", [])
    total_rows = _get_total_rows(session)

    # Step 1: Classify the question
    classification = await _classify_question(question, schema, semantic_layer)
    category = classification.get("category", "sql_query")
    needs_web = classification.get("needs_web_context", False) and include_web

    # Hard override: keyword-based routing that always wins over LLM classification.
    q_lower = question.lower()
    STATISTICAL_KEYWORDS = [
        "correlation", "heatmap", "distribution", "histogram",
        "box plot", "boxplot", "violin", "scatter", "regression",
        "pairplot", "pair plot", "outlier", "cluster", "clustering",
        "statistical", "statistics", "matplotlib", "seaborn",
        "std", "variance", "skew", "kurtosis", "covariance",
    ]
    if any(kw in q_lower for kw in STATISTICAL_KEYWORDS):
        category = "statistical_analysis"

    # Step 2: Route to appropriate agent(s)
    result = {}

    if category == "general":
        result = await _handle_general(question, schema)

    elif category in ("sql_query", "visualization"):
        sql_result = await run_sql_agent(
            question=question,
            session=session,
            include_chart=include_chart or category == "visualization",
        )
        result = {
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

        if result["chart"] and sql_result.get("data"):
            result["chart"]["data"] = sql_result["data"][:50]

    elif category == "statistical_analysis":
        # Inject primary df into session for code_agent compatibility
        primary_df = _get_primary_df(session)
        session_with_df = {**session, "df": primary_df}
        code_result = await run_code_agent(
            question=question,
            session=session_with_df,
        )
        primary_len = len(primary_df) if primary_df is not None else 0
        result = {
            "agent_used": "code_agent",
            "sql_query": None,
            "python_code": code_result.get("python_code"),
            "chart": None,
            "matplotlib_image": (
                code_result["matplotlib_images"][0]
                if code_result.get("matplotlib_images")
                else None
            ),
            "matplotlib_images": code_result.get("matplotlib_images", []),
            "data": [],
            "columns_used": [],
            "row_count": primary_len,
            "total_rows": total_rows,
            "error": code_result.get("error"),
            "stdout": code_result.get("stdout", ""),
        }

    elif category == "web_search":
        search_query = classification.get("search_query") or build_search_query(question)
        search_result = await run_search_agent(query=search_query)
        result = {
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

    else:
        sql_result = await run_sql_agent(question=question, session=session, include_chart=include_chart)
        result = {
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

    # Step 3: Fetch web context
    web_results = result.get("web_results", [])
    if needs_web and category != "web_search":
        try:
            search_query = classification.get("search_query") or build_search_query(question)
            search_result = await run_search_agent(query=search_query, max_results=3)
            web_results = search_result.get("results", [])
        except Exception:
            web_results = []

    # Step 4: Generate plain English explanation OR bypass if sensitive
    has_sensitive_data = False
    if sensitive_columns and result.get("columns_used"):
        sensitive_lower = [c.lower() for c in sensitive_columns]
        for c in result["columns_used"]:
            if c.lower() in sensitive_lower:
                has_sensitive_data = True
                break

    if has_sensitive_data:
        answer = "⚠️ **Security Notice:** The results contain sensitive columns you have specified. To prevent data leakage, an AI-generated summary is not available for this query, but you can view the direct result below."
    else:
        explanation_data = result.get("data", [])
        if result.get("stdout"):
            explanation_data = result["stdout"]

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
            )
        except Exception as e:
            answer = result.get(
                "stdout",
                f"I analyzed your question but couldn't generate a summary. Error: {str(e)}",
            )

    if category == "general" and result.get("answer"):
        answer = result["answer"]

    # Step 4b: Follow-up suggestions
    if result.get("error"):
        suggestions = []
    else:
        suggestions = await _suggest_followups(question, answer, schema)

    # Step 5: Confidence score
    confidence = calculate_confidence(
        rows_used=result.get("row_count", 0),
        total_rows=result.get("total_rows", 0),
        columns_used=result.get("columns_used", []),
        schema=schema,
        question=question,
        web_results=web_results,
        sql_error=result.get("error"),
    )

    # Step 6: Sources
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
        "from_cache": False,
    }


async def _suggest_followups(question: str, answer: str, schema: list) -> list[str]:
    """Generate 3 follow-up questions based on the current Q&A and schema."""
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


async def _classify_question(question: str, schema: list, semantic_layer) -> dict:
    """Classify the user's question to determine which agent to use."""
    schema_summary = json.dumps(
        [{"name": s["name"], "type": s["type"], "table": s.get("table", "")} for s in schema],
        indent=2,
    )
    semantic_str = semantic_layer.to_json() if semantic_layer else "None"

    system_prompt = CLASSIFY_SYSTEM_PROMPT.format(
        schema=schema_summary,
        semantic_layer=semantic_str,
    )

    try:
        result = await gemini.generate_json(
            prompt=f"User question: {question}",
            system_instruction=system_prompt,
            temperature=0.1,
        )
        return result
    except Exception:
        return {"category": "sql_query", "needs_web_context": False, "search_query": None}


async def _handle_general(question: str, schema: list) -> dict:
    """Handle general/meta questions without calling any agent."""
    question_lower = question.lower().strip()

    dataset_description_keywords = [
        "about", "describe", "overview", "summary", "tell me", "what is this",
        "what kind", "what type", "what does", "what data", "what columns",
        "column", "schema", "fields", "variables", "contain", "have in it",
        "csv", "dataset", "file",
    ]

    greetings = ["hello", "hi", "hey", "what can you do"]
    is_greeting = any(g in question_lower for g in greetings)
    is_dataset_question = any(k in question_lower for k in dataset_description_keywords)

    if is_dataset_question or is_greeting:
        numeric_cols = [s for s in schema if s["type"] in ("INTEGER", "REAL", "FLOAT", "NUMERIC")]
        text_cols   = [s for s in schema if s["type"] == "TEXT"]
        date_cols   = [s for s in schema if s["type"] in ("DATE", "TIMESTAMP", "DATETIME")]
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
        if numeric_cols:
            examples.append(f'"Show a distribution of {numeric_cols[0]["name"]}"')

        examples_md = "\n".join(f"- {e}" for e in examples[:4])

        greeting = "Hello! I'm DataTalk — ask me anything about your data.\n\n" if is_greeting else ""

        # Group columns by table for the overview
        from collections import defaultdict
        by_table = defaultdict(list)
        for col in schema:
            by_table[col.get("table", "")].append(col["name"])

        table_summary = ""
        if len(by_table) > 1:
            table_lines = "\n".join(
                f"- **{t}**: {', '.join(cols[:5])}" + (f" + {len(cols)-5} more" if len(cols) > 5 else "")
                for t, cols in by_table.items()
            )
            table_summary = f"\n\n**Loaded tables:**\n{table_lines}"

        answer = (
            f"{greeting}"
            f"## Your dataset at a glance\n\n"
            f"It contains **{len(schema)} columns** of information:"
            f"{table_summary}\n\n"
            f"{groups_md}"
            f"{quality_md}\n\n"
            f"---\n\n"
            f"**Here are some things you can ask:**\n\n"
            f"{examples_md}"
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
        "sql_query": None,
        "python_code": None,
        "chart": None,
        "matplotlib_image": None,
        "data": [],
        "columns_used": [],
        "row_count": 0,
        "total_rows": 0,
        "answer": answer,
    }
