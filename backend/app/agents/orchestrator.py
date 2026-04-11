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


async def process_question(
    question: str,
    session: dict,
    options: dict = {},
) -> dict:
    """
    Main orchestrator: classify the question, route to agents, assemble response.

    Args:
        question: User's natural language question.
        session: Session dict with db, df, schema, semantic_layer.
        options: Optional settings (include_chart, include_web_search).

    Returns:
        Complete response dict matching the API contract.
    """
    schema = session["schema"]
    semantic_layer = session.get("semantic_layer")
    include_chart = options.get("include_chart", True)
    include_web = options.get("include_web_search", True)

    # Step 1: Classify the question
    classification = await _classify_question(question, schema, semantic_layer)
    category = classification.get("category", "sql_query")
    needs_web = classification.get("needs_web_context", False) and include_web

    # Hard override: keyword-based routing that always wins over LLM classification.
    # Prevents common misrouting of statistical questions to sql_agent.
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
        # SQL Agent
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
            "total_rows": sql_result.get("total_rows", 0),
            "error": sql_result.get("error"),
        }

        # If chart data exists, cap it at 50 data points for frontend
        if result["chart"] and sql_result.get("data"):
            result["chart"]["data"] = sql_result["data"][:50]

    elif category == "statistical_analysis":
        # Code Agent
        code_result = await run_code_agent(
            question=question,
            session=session,
        )
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
            "data": [],
            "columns_used": [],
            "row_count": len(session["df"]),
            "total_rows": len(session["df"]),
            "error": code_result.get("error"),
            "stdout": code_result.get("stdout", ""),
        }

    elif category == "web_search":
        # Search Agent only
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
            "total_rows": len(session.get("df", [])),
            "web_results": search_result.get("results", []),
        }

    # Step 3: Fetch web context (if needed and not already a web search)
    web_results = result.get("web_results", [])
    if needs_web and category != "web_search":
        try:
            search_query = classification.get("search_query") or build_search_query(question)
            search_result = await run_search_agent(query=search_query, max_results=3)
            web_results = search_result.get("results", [])
        except Exception:
            web_results = []

    # Step 4: Generate plain English explanation
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

    # For general questions, use the pre-built answer
    if category == "general" and result.get("answer"):
        answer = result["answer"]

    # Step 5: Calculate confidence score
    confidence = calculate_confidence(
        rows_used=result.get("row_count", 0),
        total_rows=result.get("total_rows", 0),
        columns_used=result.get("columns_used", []),
        schema=schema,
        question=question,
        web_results=web_results,
        sql_error=result.get("error"),
    )

    # Step 6: Build sources list
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

    # Step 7: Assemble final response (matches the API contract exactly)
    return {
        "answer": answer,
        "agent_used": result.get("agent_used", "unknown"),
        "sql_query": result.get("sql_query"),
        "python_code": result.get("python_code"),
        "chart": result.get("chart"),
        "matplotlib_image": result.get("matplotlib_image"),
        "confidence": confidence,
        "sources": sources,
        "from_cache": False,
    }


async def _classify_question(question: str, schema: list, semantic_layer) -> dict:
    """Classify the user's question to determine which agent to use."""
    schema_summary = json.dumps(
        [{"name": s["name"], "type": s["type"]} for s in schema],
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
        # Default to sql_query if classification fails
        return {"category": "sql_query", "needs_web_context": False, "search_query": None}


async def _handle_general(question: str, schema: list) -> dict:
    """Handle general/meta questions without calling any agent."""
    question_lower = question.lower().strip()

    # Keywords that indicate the user wants to understand the dataset
    dataset_description_keywords = [
        "about", "describe", "overview", "summary", "tell me", "what is this",
        "what kind", "what type", "what does", "what data", "what columns",
        "column", "schema", "fields", "variables", "contain", "have in it",
        "csv", "dataset", "file",
    ]

    greetings = ["hello", "hi", "hey", "what can you do"]
    is_greeting = any(g in question_lower for g in greetings)
    is_dataset_question = any(k in question_lower for k in dataset_description_keywords)

    if is_dataset_question:
        # Group columns by type for a structured summary
        numeric_cols = [s for s in schema if s["type"] in ("INTEGER", "REAL", "FLOAT", "NUMERIC")]
        text_cols = [s for s in schema if s["type"] == "TEXT"]
        date_cols = [s for s in schema if s["type"] in ("DATE", "TIMESTAMP", "DATETIME")]
        bool_cols = [s for s in schema if s["type"] == "BOOLEAN"]

        type_lines = []
        if numeric_cols:
            names = ", ".join(c["name"] for c in numeric_cols[:5])
            suffix = f" + {len(numeric_cols) - 5} more" if len(numeric_cols) > 5 else ""
            type_lines.append(f"**{len(numeric_cols)} numeric:** {names}{suffix}")
        if text_cols:
            names = ", ".join(c["name"] for c in text_cols[:5])
            suffix = f" + {len(text_cols) - 5} more" if len(text_cols) > 5 else ""
            type_lines.append(f"**{len(text_cols)} text:** {names}{suffix}")
        if date_cols:
            names = ", ".join(c["name"] for c in date_cols)
            type_lines.append(f"**{len(date_cols)} date/time:** {names}")
        if bool_cols:
            type_lines.append(f"**{len(bool_cols)} boolean:** {', '.join(c['name'] for c in bool_cols)}")

        column_details = "\n".join([
            f"• **{s['name']}** ({s['type']}) — e.g., {', '.join(str(v) for v in s['sample_values'][:2])}"
            + (f"  ⚠️ {s['missing_pct']:.0f}% missing" if s.get("missing_pct", 0) > 10 else "")
            for s in schema
        ])

        # Build schema-aware example questions
        examples = []
        if numeric_cols and text_cols:
            examples.append(f'"What is the total {numeric_cols[0]["name"]} by {text_cols[0]["name"]}?"')
        if date_cols and numeric_cols:
            examples.append(f'"Show me {numeric_cols[0]["name"]} trends over time"')
        if date_cols:
            examples.append(f'"Plot incidents per year as a graph"')
        if len(numeric_cols) >= 2:
            examples.append(f'"Run a correlation analysis on {numeric_cols[0]["name"]} and {numeric_cols[1]["name"]}"')
        examples.append('"What are the top 10 records by value?"')

        answer = (
            f"Your dataset has **{len(schema)} columns** ({len(schema)} fields total):\n\n"
            + "\n".join(f"• {t}" for t in type_lines)
            + f"\n\n**Full column list:**\n{column_details}"
            + f"\n\n**Try asking:**\n"
            + "\n".join(f"• {e}" for e in examples[:4])
        )

    elif is_greeting:
        columns = [s["name"] for s in schema]
        numeric_cols = [s for s in schema if s["type"] in ("INTEGER", "REAL", "FLOAT", "NUMERIC")]
        text_cols = [s for s in schema if s["type"] == "TEXT"]
        date_cols = [s for s in schema if s["type"] in ("DATE", "TIMESTAMP", "DATETIME")]

        examples = []
        if numeric_cols and text_cols:
            examples.append(f'"What is the total {numeric_cols[0]["name"]} by {text_cols[0]["name"]}?"')
        if date_cols:
            examples.append(f'"Show me trends over time"')
        if len(numeric_cols) >= 2:
            examples.append(f'"Correlate {numeric_cols[0]["name"]} and {numeric_cols[1]["name"]}"')
        examples.append('"What are the top 10 records?"')

        answer = (
            f"Hello! I'm DataTalk. Your dataset has **{len(schema)} columns**: "
            f"{', '.join(columns[:6])}{'...' if len(columns) > 6 else ''}.\n\n"
            f"Try asking:\n"
            + "\n".join(f"• {e}" for e in examples)
        )

    else:
        answer = (
            "I can help you analyze your dataset. Try asking something like:\n"
            "• \"What is this dataset about?\"\n"
            "• \"Show me a graph of incidents per year\"\n"
            "• \"What are the top categories by count?\""
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
