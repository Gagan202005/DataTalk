"""
SQL Agent: Natural Language → DuckDB SQL → Execute → Return results.
Schema-only approach: raw data is NEVER sent to the LLM.
"""
import json
import re
from typing import Any
from app.utils.gemini_client import gemini


# System prompt for SQL generation
SQL_SYSTEM_PROMPT = """You are a DuckDB SQL expert. Given this database schema and metric definitions, generate ONLY a valid DuckDB SQL query.

Rules:
1. ONLY reference columns that exist in the schema below.
2. Use metric definitions from the semantic layer when the user references a defined metric.
3. Always include meaningful aliases with AS.
4. For time-series: ORDER BY the date/time column.
5. For comparisons: include all relevant grouping columns.
6. The table name is always 'data'.
7. For date filtering use standard SQL: WHERE date_column >= '2024-01-01' (DuckDB handles ISO date strings natively).
8. Output ONLY the raw SQL query — no markdown, no explanation, no backticks, no code fences.
9. If the question cannot be answered with the given schema, return: SELECT 'CANNOT_ANSWER' as error;
10. DuckDB supports STRFTIME, DATE_TRUNC, DATE_DIFF, and standard window functions — use them for time analysis.

CRITICAL — GRAPHS AND AGGREGATIONS:
11. When the user asks for a graph, chart, plot, or visualization — ALWAYS aggregate with GROUP BY + COUNT(*) or SUM/AVG. NEVER select individual rows for a chart.
12. For "X vs Y graph" or "X by Y": GROUP BY the categorical/time column and aggregate (COUNT or SUM) the numeric/count dimension.
13. For time-based charts (year vs count, monthly trend, etc.): extract the time unit using STRFTIME (e.g., STRFTIME('%Y', date_col) AS year), GROUP BY it, and COUNT(*) AS incident_count (or SUM of numeric col). ORDER BY the time column.
14. Aggregation queries (GROUP BY) must NOT have a LIMIT unless the user explicitly asks for "top N". All groups should be returned.
15. Only use LIMIT 100 for raw record lookups where no GROUP BY is present.
"""

# System prompt for chart recommendation
CHART_SYSTEM_PROMPT = """Based on this SQL query and its results, recommend a chart type and data mapping.

Respond with ONLY a JSON object:
{
    "should_chart": true/false,
    "chart_type": "bar" | "line" | "pie" | "scatter" | "area",
    "x_key": "column_name_for_x_axis",
    "y_key": "column_name_for_y_axis",
    "title": "Chart Title"
}

Rules:
- "bar": for comparing categories (region, type, etc.)
- "line": for time series / trends
- "pie": for proportions / percentages (max 8 slices)
- "scatter": for correlations between two numeric columns
- "area": for cumulative / stacked time series
- If results have <= 1 row or are not visual, set should_chart to false
"""


async def run_sql_agent(
    question: str,
    session: dict,
    include_chart: bool = True,
) -> dict:
    """
    Process a natural language question through the SQL pipeline.

    Args:
        question: User's plain English question.
        session: Session dict containing db, schema, semantic_layer.
        include_chart: Whether to generate chart recommendations.

    Returns:
        Dict with sql_query, data, chart, columns_used, row_count.
    """
    db = session["db"]
    schema = session["schema"]
    semantic_layer = session.get("semantic_layer")

    # Format schema for prompt
    schema_str = json.dumps(schema, indent=2)
    semantic_str = semantic_layer.to_json() if semantic_layer else "No custom metrics defined."

    # Build the full prompt
    full_system = SQL_SYSTEM_PROMPT + f"\n\nSchema:\n{schema_str}\n\nSemantic Layer:\n{semantic_str}"

    # Step 1: Generate SQL
    sql_query = await gemini.generate(
        prompt=f"User question: {question}",
        system_instruction=full_system,
        temperature=0.1,
    )

    # Clean up the SQL
    sql_query = _clean_sql(sql_query)

    # Step 2: Execute SQL (with retry on failure)
    result = db.execute_query(sql_query)

    if not result["success"]:
        # Retry: send error back to Gemini to fix
        retry_prompt = (
            f"The following SQL query failed:\n{sql_query}\n\n"
            f"Error: {result['error']}\n\n"
            f"Fix the SQL query. Remember: table name is 'data'. "
            f"Only use columns from the schema. Output ONLY the fixed SQL."
        )

        sql_query = await gemini.generate(
            prompt=retry_prompt,
            system_instruction=full_system,
            temperature=0.1,
        )
        sql_query = _clean_sql(sql_query)
        result = db.execute_query(sql_query)

        # Second retry — simplify
        if not result["success"]:
            retry_prompt2 = (
                f"SQL still failing:\n{sql_query}\n\n"
                f"Error: {result['error']}\n\n"
                f"Write a simpler query. Use basic SELECT, WHERE, GROUP BY. "
                f"Table is 'data'. Output ONLY SQL."
            )
            sql_query = await gemini.generate(
                prompt=retry_prompt2,
                system_instruction=full_system,
                temperature=0.2,
            )
            sql_query = _clean_sql(sql_query)
            result = db.execute_query(sql_query)

    if not result["success"]:
        return {
            "sql_query": sql_query,
            "data": [],
            "chart": None,
            "columns_used": [],
            "row_count": 0,
            "total_rows": db.get_row_count(),
            "error": f"Could not execute query: {result['error']}",
        }

    # Step 3: Determine chart type (if requested and results are chartable)
    chart = None
    if include_chart and result["data"] and len(result["data"]) > 1:
        try:
            chart = await _recommend_chart(sql_query, result["data"][:10], result["columns"])
        except Exception:
            chart = None  # Charts are optional, don't fail on this

    # Extract columns used from SQL
    columns_used = _extract_columns_from_sql(sql_query, schema)

    return {
        "sql_query": sql_query,
        "data": result["data"],
        "chart": chart,
        "columns_used": columns_used,
        "row_count": result["row_count"],
        "total_rows": db.get_row_count(),
    }


def _clean_sql(sql: str) -> str:
    """Clean up SQL output from the LLM."""
    sql = sql.strip()
    # Remove markdown code fences
    sql = re.sub(r'^```\w*\n?', '', sql)
    sql = re.sub(r'\n?```$', '', sql)
    # Remove leading/trailing whitespace and semicolons
    sql = sql.strip().rstrip(';').strip()
    # Add back a single semicolon
    sql = sql + ";"
    return sql


async def _recommend_chart(sql: str, sample_data: list, columns: list) -> dict | None:
    """Ask Gemini to recommend a chart type for the results."""
    prompt = (
        f"SQL query: {sql}\n\n"
        f"Result columns: {columns}\n"
        f"Sample data (first rows): {json.dumps(sample_data[:5])}\n"
    )

    result = await gemini.generate_json(
        prompt=prompt,
        system_instruction=CHART_SYSTEM_PROMPT,
        temperature=0.1,
    )

    if result.get("should_chart"):
        x_key = result.get("x_key", columns[0] if columns else "name")
        y_key = result.get("y_key", columns[1] if len(columns) > 1 else columns[0])

        # Validate keys actually exist in the data to prevent frontend crashes
        if sample_data:
            available_keys = list(sample_data[0].keys())
            if x_key not in available_keys:
                x_key = available_keys[0]
            if y_key not in available_keys:
                y_key = available_keys[1] if len(available_keys) > 1 else available_keys[0]

        return {
            "type": result.get("chart_type", "bar"),
            "data": sample_data,  # Will be replaced with full data in orchestrator
            "x_key": x_key,
            "y_key": y_key,
            "title": result.get("title", "Chart"),
        }
    return None


def _extract_columns_from_sql(sql: str, schema: list) -> list[str]:
    """Extract which schema columns are referenced in the SQL query."""
    sql_lower = sql.lower()
    used = []
    for col_info in schema:
        col_name = col_info["name"].lower()
        if col_name in sql_lower:
            used.append(col_info["name"])
    return used
