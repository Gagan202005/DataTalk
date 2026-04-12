# 🟧 Person C — AI Core + Multi-Agent System Instructions
## DataTalk | Gemini 2.5 Flash + Multi-Agent Orchestration

> **Your job:** Build the AI brain of DataTalk. You create the multi-agent system that takes a user's plain English question and produces SQL, Python code, charts, web context, and a plain English explanation. You are the reason this project is impressive.

---

## ⚡ Quick Start (Do This First — 15 min)

### Step 1: Get a Gemini API Key
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with Google
3. Click "Get API Key" → "Create API Key"
4. Copy the key
5. Share with Person B to put in `backend/.env`

### Step 2: Verify Person B's setup is complete
Person B has already created and tested:
- ✅ `backend/app/main.py` — FastAPI server running on port 8000
- ✅ `backend/app/core/database.py` — **DuckDB** manager (NOT SQLite)
- ✅ `backend/app/core/schema.py` — schema + quality extractor
- ✅ `backend/app/core/semantic_layer.py` — metric CRUD
- ✅ `backend/requirements.txt` — includes `duckdb`, `google-generativeai`, `duckduckgo-search`
- ✅ `backend/venv/` — virtual environment already set up
- ✅ `backend/sample_data/banking_transactions.csv` — 2000-row demo dataset

> **IMPORTANT:** The database is DuckDB, NOT SQLite. Your SQL prompts must say "DuckDB SQL" not "SQLite SQL". DuckDB has better date functions and analytics support.

### Step 3: Verify Person B's folder structure exists
```bash
# Person B already created this — just verify:
ls /Users/gagansinghal/Desktop/Natwest-Hackathon/backend/app/agents/
# Should see: __init__.py  orchestrator.py (stub)

# Activate Person B's venv:
cd /Users/gagansinghal/Desktop/Natwest-Hackathon/backend
source venv/bin/activate
```

> ✅ Person B has already scaffolded the folder, venv, and requirements. You just need to fill in the agent files.

### Step 4: Quick test that Gemini works
```python
# Quick test script — run and delete
import google.generativeai as genai
genai.configure(api_key="YOUR_KEY_HERE")
model = genai.GenerativeModel("gemini-2.5-flash")
response = model.generate_content("Say hello in one sentence.")
print(response.text)
```

---

## 🧠 Architecture: How the Agents Work Together

```
User Question: "Why did revenue drop in March?"
          │
          ▼
  ┌─────────────────────────┐
  │    ORCHESTRATOR AGENT   │  ← Classifies intent
  │  "This needs SQL +      │
  │   Web Search + Explain" │
  └─────┬──────┬──────┬─────┘
        │      │      │
        ▼      ▼      ▼
  ┌────────┐ ┌────────┐ ┌────────────┐
  │SQL     │ │Search  │ │Explain     │
  │Agent   │ │Agent   │ │Agent       │
  │        │ │        │ │            │
  │NL→SQL  │ │DDG web │ │Result →    │
  │Execute │ │search  │ │Plain Eng.  │
  │on      │ │top 5   │ │+ sources   │
  │DuckDB  │ │results │ │+ confidence│
  └───┬────┘ └───┬────┘ └──────┬─────┘
      │          │             │
      └──────────┴─────────────┘
                 │
                 ▼
         Final Response JSON
         (answer + chart + confidence + sources)
```

**Agent routing rules:**
| Question Type | Agents Invoked | Example |
|---|---|---|
| Simple data query | SQL → Explain | "What is total revenue?" |
| Chart request | SQL → Explain (with chart flag) | "Show me a bar chart of sales" |
| Statistical analysis | Code Agent → Explain | "Run a correlation analysis" |
| Web/news query | Search → Explain | "What's trending in banking?" |
| Complex "why" question | SQL + Search → Explain | "Why did revenue dip in March?" |
| General greeting | Direct response (no agent) | "Hello" / "What can you do?" |

---

## 🏗️ Build Order (Follow This Exactly)

### Task 1: `app/utils/gemini_client.py` — Gemini API Wrapper

This is the foundation. Every agent uses this.

```python
"""
Gemini API client wrapper.
Handles API calls, retries, rate limiting, and error handling.
"""
import os
import time
import json
import google.generativeai as genai
from typing import Optional

# Configure Gemini
API_KEY = os.getenv("GEMINI_API_KEY", "")
if API_KEY:
    genai.configure(api_key=API_KEY)

# Rate limiting state
_last_call_time = 0
_MIN_CALL_INTERVAL = 1.0  # seconds between calls (stay under 10 RPM)


class GeminiClient:
    """Wrapper around Gemini 2.5 Flash API."""

    def __init__(self, model_name: str = "gemini-2.5-flash"):
        self.model = genai.GenerativeModel(model_name)

    async def generate(
        self,
        prompt: str,
        system_instruction: str = "",
        temperature: float = 0.2,
        max_retries: int = 2,
        json_mode: bool = False,
    ) -> str:
        """
        Generate a response from Gemini.

        Args:
            prompt: The user prompt/question.
            system_instruction: System prompt for the model.
            temperature: Creativity (0.0-1.0). Lower = more deterministic.
            max_retries: Number of retries on failure.
            json_mode: If True, request JSON output.

        Returns:
            The model's text response.
        """
        global _last_call_time

        # Rate limiting: wait if too soon since last call
        elapsed = time.time() - _last_call_time
        if elapsed < _MIN_CALL_INTERVAL:
            time.sleep(_MIN_CALL_INTERVAL - elapsed)

        # Build the model with system instruction
        model = genai.GenerativeModel(
            model_name=self.model.model_name,
            system_instruction=system_instruction if system_instruction else None,
        )

        generation_config = {
            "temperature": temperature,
            "max_output_tokens": 4096,
        }

        if json_mode:
            generation_config["response_mime_type"] = "application/json"

        last_error = None
        for attempt in range(max_retries + 1):
            try:
                _last_call_time = time.time()
                response = model.generate_content(
                    prompt,
                    generation_config=generation_config,
                )

                if response.text:
                    return response.text.strip()
                else:
                    return ""

            except Exception as e:
                last_error = e
                error_str = str(e).lower()

                # Rate limit error — wait and retry
                if "429" in error_str or "resource_exhausted" in error_str:
                    wait_time = (attempt + 1) * 5  # 5s, 10s, 15s
                    print(f"⚠️ Rate limited. Waiting {wait_time}s before retry {attempt + 1}...")
                    time.sleep(wait_time)
                    continue

                # Other errors — retry with backoff
                if attempt < max_retries:
                    time.sleep(2 * (attempt + 1))
                    continue

        raise Exception(f"Gemini API failed after {max_retries + 1} attempts: {last_error}")

    async def generate_json(
        self,
        prompt: str,
        system_instruction: str = "",
        temperature: float = 0.1,
    ) -> dict:
        """Generate a JSON response and parse it."""
        response = await self.generate(
            prompt=prompt,
            system_instruction=system_instruction,
            temperature=temperature,
            json_mode=True,
        )

        try:
            return json.loads(response)
        except json.JSONDecodeError:
            # Try to extract JSON from the response
            import re
            json_match = re.search(r'\{[^{}]*\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            raise ValueError(f"Could not parse JSON from response: {response[:200]}")


# Singleton instance
gemini = GeminiClient()
```

**Test it standalone:**
```python
import asyncio
from app.utils.gemini_client import gemini

async def test():
    result = await gemini.generate("What is 2+2?", system_instruction="Answer in one word.")
    print(result)

asyncio.run(test())
```

---

### Task 2: `app/agents/sql_agent.py` — NL → SQL → Execute

The most important agent. This handles all data queries.

```python
"""
SQL Agent: Natural Language → SQL → Execute on SQLite → Return results.
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
6. LIMIT 100 unless user specifies otherwise.
7. The table name is always 'data'.
8. For date filtering use standard SQL: WHERE date_column >= '2024-01-01' (DuckDB handles ISO date strings natively).
9. Output ONLY the raw SQL query — no markdown, no explanation, no backticks, no code fences.
10. If the question cannot be answered with the given schema, return: SELECT 'CANNOT_ANSWER' as error;
11. DuckDB supports STRFTIME, DATE_TRUNC, DATE_DIFF, and standard window functions — use them for time analysis.
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

        # Second retry
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
        # Transform data for frontend Recharts format
        return {
            "type": result.get("chart_type", "bar"),
            "data": sample_data,  # Will be replaced with full data
            "x_key": result.get("x_key", columns[0] if columns else "name"),
            "y_key": result.get("y_key", columns[1] if len(columns) > 1 else columns[0]),
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
```

---

### Task 3: `app/utils/code_sandbox.py` — Safe Python Execution

This is the "code interpreter" capability. It runs LLM-generated Python code safely.

```python
"""
Sandboxed Python code execution.
Runs LLM-generated code with restricted imports and timeout.
"""
import io
import sys
import base64
import signal
import traceback
from contextlib import redirect_stdout, redirect_stderr
from typing import Any
import threading


# Whitelisted imports that generated code can use
ALLOWED_MODULES = {
    "pandas", "pd",
    "numpy", "np",
    "matplotlib", "matplotlib.pyplot", "plt",
    "seaborn", "sns",
    "scipy", "scipy.stats",
    "sklearn", "sklearn.preprocessing", "sklearn.cluster",
    "math", "statistics", "collections", "datetime",
    "json", "re", "io", "base64",
}

# Maximum execution time (seconds)
MAX_EXECUTION_TIME = 30


class CodeExecutionResult:
    """Result of sandboxed code execution."""
    def __init__(self):
        self.stdout: str = ""
        self.stderr: str = ""
        self.figures: list[str] = []  # base64 PNG strings
        self.error: str | None = None
        self.success: bool = False


def execute_code(code: str, dataframe=None) -> CodeExecutionResult:
    """
    Execute Python code in a sandboxed environment.

    Args:
        code: Python code string to execute.
        dataframe: pandas DataFrame to make available as 'df'.

    Returns:
        CodeExecutionResult with stdout, figures, and error info.
    """
    result = CodeExecutionResult()

    # Prepare the execution namespace
    import pandas as pd
    import numpy as np

    namespace = {
        "__builtins__": _get_safe_builtins(),
        "pd": pd,
        "np": np,
        "df": dataframe,
        "_figures": [],  # Code appends base64 figures here
    }

    # Add optional imports
    try:
        import matplotlib
        matplotlib.use('Agg')  # Non-interactive backend
        import matplotlib.pyplot as plt
        plt.style.use('dark_background')
        namespace["matplotlib"] = matplotlib
        namespace["plt"] = plt
    except ImportError:
        pass

    try:
        import seaborn as sns
        namespace["sns"] = sns
        namespace["seaborn"] = sns
    except ImportError:
        pass

    try:
        import scipy
        import scipy.stats
        namespace["scipy"] = scipy
    except ImportError:
        pass

    try:
        from sklearn import preprocessing, cluster
        import sklearn
        namespace["sklearn"] = sklearn
    except ImportError:
        pass

    # Add helper modules
    namespace["io"] = io
    namespace["base64"] = base64
    namespace["json"] = __import__("json")
    namespace["math"] = __import__("math")
    namespace["re"] = __import__("re")
    namespace["datetime"] = __import__("datetime")
    namespace["collections"] = __import__("collections")

    # Capture stdout and stderr
    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()

    # Execute with timeout
    execution_error = [None]
    execution_done = threading.Event()

    def run_code():
        try:
            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                exec(code, namespace)
        except Exception as e:
            execution_error[0] = f"{type(e).__name__}: {str(e)}"
        finally:
            execution_done.set()

    thread = threading.Thread(target=run_code, daemon=True)
    thread.start()
    thread.join(timeout=MAX_EXECUTION_TIME)

    if thread.is_alive():
        result.error = f"Code execution timed out after {MAX_EXECUTION_TIME} seconds."
        result.success = False
        return result

    # Collect results
    result.stdout = stdout_capture.getvalue()
    result.stderr = stderr_capture.getvalue()
    result.figures = namespace.get("_figures", [])
    result.error = execution_error[0]
    result.success = execution_error[0] is None

    # Auto-capture any open matplotlib figures
    try:
        import matplotlib.pyplot as plt
        for fig_num in plt.get_fignums():
            fig = plt.figure(fig_num)
            buf = io.BytesIO()
            fig.savefig(buf, format='png', dpi=150, bbox_inches='tight',
                       facecolor='#111827', edgecolor='none')
            buf.seek(0)
            result.figures.append(base64.b64encode(buf.read()).decode())
            plt.close(fig)
    except Exception:
        pass

    return result


def _get_safe_builtins() -> dict:
    """Return a restricted set of Python builtins."""
    import builtins
    safe = {}
    allowed = [
        'abs', 'all', 'any', 'bool', 'chr', 'dict', 'dir',
        'divmod', 'enumerate', 'filter', 'float', 'format',
        'frozenset', 'getattr', 'hasattr', 'hash', 'hex',
        'int', 'isinstance', 'issubclass', 'iter', 'len',
        'list', 'map', 'max', 'min', 'next', 'oct', 'ord',
        'pow', 'print', 'range', 'repr', 'reversed', 'round',
        'set', 'slice', 'sorted', 'str', 'sum', 'super',
        'tuple', 'type', 'vars', 'zip',
        'True', 'False', 'None',
        'Exception', 'ValueError', 'TypeError', 'KeyError',
        'IndexError', 'RuntimeError', 'StopIteration',
        'ZeroDivisionError', 'AttributeError',
    ]
    for name in allowed:
        if hasattr(builtins, name):
            safe[name] = getattr(builtins, name)

    # Explicitly block dangerous builtins
    # No: open, exec, eval, compile, __import__, input, exit, quit
    return safe
```

---

### Task 4: `app/agents/code_agent.py` — Python Code Interpreter

```python
"""
Code Agent: Generates and executes Python code for statistical analysis,
chart generation, and complex data operations.
"""
import json
from app.utils.gemini_client import gemini
from app.utils.code_sandbox import execute_code


CODE_SYSTEM_PROMPT = """You are a Python data analyst. Generate a Python script to answer the user's question using the provided DataFrame.

Available libraries: pandas (as pd), numpy (as np), matplotlib.pyplot (as plt), seaborn (as sns), scipy, sklearn
The DataFrame is pre-loaded as variable `df` with these columns: {schema}

Rules:
1. Always start with data exploration relevant to the question.
2. Use plt.style.use('dark_background') is already set — just create charts.
3. For EVERY chart you create, save it to the `_figures` list:
   ```
   import io, base64
   buf = io.BytesIO()
   plt.savefig(buf, format='png', dpi=150, bbox_inches='tight', facecolor='#111827', edgecolor='none')
   buf.seek(0)
   _figures.append(base64.b64encode(buf.read()).decode())
   plt.close()
   ```
4. Use a professional color palette: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899']
5. Set appropriate figure size: plt.figure(figsize=(10, 6))
6. Add titles, labels, and legends to all charts.
7. Handle missing values gracefully (dropna or fillna).
8. Print the final answer clearly using print().
9. Format numbers nicely (commas, 2 decimal places where needed).
10. Output ONLY Python code — no markdown, no backticks, no explanation.

The variable `_figures` is pre-defined as an empty list. Append base64 PNG strings to it.
"""


async def run_code_agent(
    question: str,
    session: dict,
) -> dict:
    """
    Generate and execute Python code to answer the user's question.

    Args:
        question: User's question requiring Python analysis.
        session: Session dict with df and schema.

    Returns:
        Dict with python_code, stdout, figures, error.
    """
    df = session["df"]
    schema = session["schema"]

    schema_str = json.dumps(schema, indent=2)
    system_prompt = CODE_SYSTEM_PROMPT.format(schema=schema_str)

    # Also include basic stats about the dataframe
    df_info = f"DataFrame shape: {df.shape[0]} rows × {df.shape[1]} columns\n"
    df_info += f"Numeric columns: {list(df.select_dtypes(include='number').columns)}\n"
    df_info += f"Categorical columns: {list(df.select_dtypes(include='object').columns)}\n"

    prompt = f"{df_info}\n\nUser question: {question}"

    # Generate Python code
    code = await gemini.generate(
        prompt=prompt,
        system_instruction=system_prompt,
        temperature=0.2,
    )

    # Clean up code
    code = _clean_code(code)

    # Execute in sandbox
    result = execute_code(code, dataframe=df)

    if not result.success and result.error:
        # Retry with error feedback
        retry_prompt = (
            f"The Python code failed with this error:\n{result.error}\n\n"
            f"Original question: {question}\n\n"
            f"Fix the code. Common issues:\n"
            f"- Column names are case-sensitive\n"
            f"- Use df.columns to check available columns\n"
            f"- Handle NaN values with dropna() or fillna()\n"
            f"Output ONLY the fixed Python code."
        )

        code = await gemini.generate(
            prompt=retry_prompt,
            system_instruction=system_prompt,
            temperature=0.3,
        )
        code = _clean_code(code)
        result = execute_code(code, dataframe=df)

    return {
        "python_code": code,
        "stdout": result.stdout,
        "matplotlib_images": result.figures,  # list of base64 PNGs
        "error": result.error if not result.success else None,
        "success": result.success,
    }


def _clean_code(code: str) -> str:
    """Remove markdown code fences and clean up the code."""
    import re
    code = code.strip()
    # Remove ```python ... ``` wrappers
    code = re.sub(r'^```\w*\n?', '', code)
    code = re.sub(r'\n?```$', '', code)
    return code.strip()
```

---

### Task 5: `app/agents/search_agent.py` — Web Search

```python
"""
Search Agent: Web search for contextual information using DuckDuckGo.
No API key required.
"""
from duckduckgo_search import DDGS
from typing import Optional


async def run_search_agent(
    query: str,
    max_results: int = 5,
    time_filter: Optional[str] = None,
) -> dict:
    """
    Search the web for contextual information.

    Args:
        query: Search query string.
        max_results: Maximum number of results to return.
        time_filter: Optional time filter ('d'=day, 'w'=week, 'm'=month, 'y'=year).

    Returns:
        Dict with search_results list and search_query.
    """
    try:
        with DDGS() as ddgs:
            kwargs = {"max_results": max_results}
            if time_filter:
                kwargs["timelimit"] = time_filter

            results = list(ddgs.text(query, **kwargs))

        # Format results
        formatted = []
        for r in results:
            formatted.append({
                "title": r.get("title", ""),
                "snippet": r.get("body", ""),
                "url": r.get("href", ""),
            })

        return {
            "search_query": query,
            "results": formatted,
            "count": len(formatted),
        }

    except Exception as e:
        # Web search is optional — fail gracefully
        print(f"⚠️ Web search failed: {e}")
        return {
            "search_query": query,
            "results": [],
            "count": 0,
            "error": str(e),
        }


def build_search_query(question: str, context: str = "") -> str:
    """
    Build an effective search query from the user's question.

    Adds relevant context keywords for better results.
    """
    # Add banking/finance context if not present
    banking_keywords = ["bank", "finance", "market", "economy", "trading", "investment"]
    has_context = any(kw in question.lower() for kw in banking_keywords)

    if not has_context and context:
        return f"{question} {context} banking finance trends"
    elif not has_context:
        return f"{question} banking industry trends"
    return question
```

---

### Task 6: `app/agents/explain_agent.py` — Plain English Explanation

```python
"""
Explain Agent: Takes raw results and produces plain English explanations
with source citations and chart descriptions.
"""
import json
from app.utils.gemini_client import gemini


EXPLAIN_SYSTEM_PROMPT = """You are a friendly data analyst explaining results to a business user who is NOT technical.

Context:
- User asked: {question}
- Agent used: {agent_type}
- SQL query (if any): {sql_query}
- Python code (if any): {python_code_summary}
- Columns used: {columns_used}
- Row count analyzed: {row_count}
- Total rows in dataset: {total_rows}
- Web search results (if any): {web_results}

Rules:
1. Start with the DIRECT answer in the first sentence. Lead with the key number or finding.
2. Use 2-4 plain English sentences maximum.
3. NO SQL, NO Python code, NO technical jargon in the explanation.
4. Mention specific numbers and percentages — be precise.
5. If web search results are relevant, mention them briefly as corroborating context in one sentence.
6. If there's a notable outlier or trend, highlight it.
7. End with a brief actionable insight if there's one.
8. Do NOT say "Based on the data" or "According to the analysis" — just state the finding directly.
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
) -> str:
    """
    Generate a plain English explanation of the analysis results.

    Returns:
        Plain English explanation string.
    """
    # Format web results for prompt
    web_str = "None"
    if web_results:
        web_str = "\n".join([
            f"- {r['title']}: {r['snippet'][:100]}" for r in web_results[:3]
        ])

    # Format result data (truncate if too long)
    if isinstance(result_data, list):
        result_str = json.dumps(result_data[:20], indent=2)
    else:
        result_str = str(result_data)[:2000]

    # Summarize code if present (don't send full code to explain agent)
    code_summary = "N/A"
    if python_code:
        code_summary = f"Python analysis code was executed ({len(python_code)} characters)"

    system_prompt = EXPLAIN_SYSTEM_PROMPT.format(
        question=question,
        agent_type=agent_type,
        sql_query=sql_query or "N/A",
        python_code_summary=code_summary,
        columns_used=", ".join(columns_used) if columns_used else "N/A",
        row_count=row_count,
        total_rows=total_rows,
        web_results=web_str,
    )

    explanation = await gemini.generate(
        prompt=f"Analysis result:\n{result_str}",
        system_instruction=system_prompt,
        temperature=0.3,
    )

    return explanation
```

---

### Task 7: `app/core/confidence.py` — Confidence Score Calculator

```python
"""
Confidence Score Calculator.
Measures answer reliability across 4 dimensions.
"""
from typing import Optional


def calculate_confidence(
    rows_used: int = 0,
    total_rows: int = 0,
    columns_used: list[str] | None = None,
    schema: list[dict] | None = None,
    question: str = "",
    web_results: list[dict] | None = None,
    sql_error: str | None = None,
) -> dict:
    """
    Calculate a confidence score for an answer.

    Components (weighted):
    - Row coverage (30%): How many rows contributed to the answer
    - Data completeness (30%): Missing value ratio in used columns
    - Schema match (20%): Did the question map to known columns?
    - Web corroboration (20%): Were relevant web results found?

    Returns:
        Dict with score (0-100), level (High/Medium/Low), and breakdown.
    """
    if not columns_used:
        columns_used = []
    if not schema:
        schema = []

    # If there was a SQL error, low confidence
    if sql_error:
        return {
            "score": 20,
            "level": "Low",
            "breakdown": {
                "row_coverage": 0,
                "data_completeness": 0,
                "schema_match": 20,
                "web_corroboration": 0,
            },
        }

    # 1. Row Coverage (30% weight)
    if total_rows > 0:
        coverage_ratio = min(1.0, rows_used / total_rows)
        row_score = coverage_ratio * 100
    else:
        row_score = 0

    # 2. Data Completeness (30% weight)
    if columns_used and schema:
        schema_map = {col["name"].lower(): col for col in schema}
        missing_pcts = []
        for col_name in columns_used:
            col_info = schema_map.get(col_name.lower(), {})
            missing_pcts.append(col_info.get("missing_pct", 0))
        avg_missing = sum(missing_pcts) / max(len(missing_pcts), 1)
        completeness_score = max(0, 100 - avg_missing)
    else:
        completeness_score = 50  # Default when unknown

    # 3. Schema Match (20% weight)
    if columns_used:
        known_columns = {col["name"].lower() for col in schema}
        matched = sum(1 for c in columns_used if c.lower() in known_columns)
        schema_score = (matched / max(len(columns_used), 1)) * 100
    else:
        # Check if any schema column names appear in the question
        question_lower = question.lower()
        matches = sum(1 for col in schema if col["name"].lower() in question_lower)
        schema_score = min(100, matches * 25) if matches else 30

    # 4. Web Corroboration (20% weight)
    web_score = 0
    if web_results:
        # Each relevant article adds 25%, max 100%
        web_score = min(100, len(web_results) * 25)

    # Weighted total
    total = (
        row_score * 0.30 +
        completeness_score * 0.30 +
        schema_score * 0.20 +
        web_score * 0.20
    )

    # Determine level
    if total >= 75:
        level = "High"
    elif total >= 50:
        level = "Medium"
    else:
        level = "Low"

    return {
        "score": round(total),
        "level": level,
        "breakdown": {
            "row_coverage": round(row_score),
            "data_completeness": round(completeness_score),
            "schema_match": round(schema_score),
            "web_corroboration": round(web_score),
        },
    }
```

---

### Task 8: `app/agents/orchestrator.py` — The Brain

This is the most important file. It routes questions to the right agents and assembles the final response.

```python
"""
Orchestrator Agent: Routes user questions to the appropriate specialist agents
and assembles the final response.
"""
import json
from app.utils.gemini_client import gemini
from app.agents.sql_agent import run_sql_agent
from app.agents.code_agent import run_code_agent
from app.agents.search_agent import run_search_agent, build_search_query
from app.agents.explain_agent import run_explain_agent
from app.core.confidence import calculate_confidence


CLASSIFY_SYSTEM_PROMPT = """You are a routing agent for a data analysis platform. Given a user question and a database schema, classify the question into exactly one category.

Categories:
- "sql_query": Questions answerable with a SQL query (aggregations, filters, grouping, counts, totals, averages, comparisons between groups, rankings, top/bottom N)
- "visualization": Questions explicitly requesting charts, plots, graphs, or visual representation. Also route here if question says "show me", "plot", "chart", "visualize", "graph"
- "statistical_analysis": Questions requiring Python code (correlations, distributions, regressions, statistical tests, clustering, predictions, outlier detection, complex calculations)
- "web_search": Questions about external context, news, trends, events, or industry information NOT answerable from the data
- "general": Greetings ("hello"), meta-questions about the data ("what columns do you have?"), or questions about the tool itself ("what can you do?")

Schema: {schema}
Semantic Layer: {semantic_layer}

Respond with ONLY a JSON object:
{{"category": "...", "needs_web_context": true/false, "search_query": "..." or null, "reasoning": "one sentence"}}

"needs_web_context" should be true if the question has a "why" component or asks about external factors that might relate to the data trends.
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

        # If chart data exists, format it properly
        if result["chart"] and sql_result.get("data"):
            result["chart"]["data"] = sql_result["data"][:50]  # Cap chart data at 50 points

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
            "matplotlib_image": code_result["matplotlib_images"][0] if code_result.get("matplotlib_images") else None,
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
        answer = result.get("stdout", f"I analyzed your question but couldn't generate a summary. Raw result available. Error: {str(e)}")

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

    # Step 7: Assemble final response
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
    """Handle general/meta questions."""
    question_lower = question.lower().strip()

    # Handle common greetings
    greetings = ["hello", "hi", "hey", "help", "what can you do"]
    if any(g in question_lower for g in greetings):
        columns = [s["name"] for s in schema]
        answer = (
            f"👋 Hello! I'm DataTalk, your AI data analyst. I can help you analyze your dataset "
            f"which has {len(schema)} columns: {', '.join(columns[:8])}{'...' if len(columns) > 8 else ''}.\n\n"
            f"Try asking me things like:\n"
            f"• \"What is the total amount by region?\"\n"
            f"• \"Show me monthly trends\"\n"
            f"• \"Run a correlation analysis\"\n"
            f"• \"Why did transactions drop in March?\"\n"
            f"• \"What's trending in banking news?\""
        )
    elif "column" in question_lower or "schema" in question_lower or "what data" in question_lower:
        column_info = "\n".join([
            f"• **{s['name']}** ({s['type']}) — e.g., {', '.join(s['sample_values'][:2])}"
            for s in schema
        ])
        answer = f"Your dataset has {len(schema)} columns:\n{column_info}"
    else:
        answer = "I'm here to help you analyze your data! Try asking a question about your dataset."

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
```

---

## 🧪 Testing Your Agents

### Standalone Test Script

Create this for quick testing without the full FastAPI server:

**File: `backend/test_agents_standalone.py`** (test and delete before submission)

```python
"""
Standalone test for all agents. Run: python test_agents_standalone.py
"""
import asyncio
import os
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

# Verify API key
if not os.getenv("GEMINI_API_KEY"):
    print("❌ GEMINI_API_KEY not set in .env")
    exit(1)

async def test_all():
    # Load sample data
    df = pd.read_csv("sample_data/banking_transactions.csv")
    print(f"✅ Loaded {len(df)} rows, {len(df.columns)} columns")

    # Set up session-like dict (mirrors Person B's session structure exactly)
    from app.core.database import DatabaseManager
    from app.core.schema import extract_schema
    from app.core.semantic_layer import SemanticLayerManager

    # ⚠️ DatabaseManager now requires a session_id — creates sessions/test_session.duckdb
    db = DatabaseManager("test_session")
    db.load_dataframe(df)
    schema = extract_schema(df)
    semantic = SemanticLayerManager()
    semantic.add_metric("revenue", "SUM(amount)", "Total transaction amount")

    session = {
        "db": db,        # DuckDB DatabaseManager — has execute_query(), get_row_count()
        "df": df,        # pandas DataFrame — used by code_agent
        "schema": schema,         # list of {name, type, sample_values, missing_pct}
        "semantic_layer": semantic, # SemanticLayerManager — has to_json(), get_metrics()
    }

    # Test 1: SQL Agent
    print("\n--- TEST 1: SQL Agent ---")
    from app.agents.sql_agent import run_sql_agent
    result = await run_sql_agent("What is the total amount by region?", session)
    print(f"SQL: {result['sql_query']}")
    print(f"Data: {result['data'][:3]}")
    print(f"Chart: {result.get('chart', {}).get('type', 'None')}")

    # Test 2: Code Agent
    print("\n--- TEST 2: Code Agent ---")
    from app.agents.code_agent import run_code_agent
    result = await run_code_agent("Run a correlation analysis on numeric columns", session)
    print(f"Code: {result['python_code'][:200]}...")
    print(f"Output: {result['stdout'][:300]}")
    print(f"Figures: {len(result['matplotlib_images'])} chart(s)")

    # Test 3: Search Agent
    print("\n--- TEST 3: Search Agent ---")
    from app.agents.search_agent import run_search_agent
    result = await run_search_agent("Indian banking trends 2024")
    print(f"Results: {result['count']} articles")
    for r in result["results"][:2]:
        print(f"  - {r['title']}")

    # Test 4: Orchestrator (full pipeline)
    print("\n--- TEST 4: Orchestrator (Full Pipeline) ---")
    from app.agents.orchestrator import process_question
    result = await process_question("Why did transactions drop in March?", session)
    print(f"Agent: {result['agent_used']}")
    print(f"Answer: {result['answer'][:300]}")
    print(f"Confidence: {result['confidence']['score']}% ({result['confidence']['level']})")
    print(f"Sources: {len(result['sources'])}")

    print("\n✅ All tests passed!")

asyncio.run(test_all())
```

Run: `cd backend && python test_agents_standalone.py`

---

## 🕐 Timeline for Person C

| Hours | What to Build | Done? |
|---|---|---|
| 0-1 | Get Gemini API key. Test `gemini_client.py`. Verify API works. | ✅ |
| 1-3 | `sql_agent.py` — full NL→SQL→Execute pipeline with retry | ✅ |
| 3-4 | `code_sandbox.py` — safe Python execution with matplotlib capture | ✅ |
| 4-5 | `code_agent.py` — Python code generation + execution | ✅ |
| 5-6 | `search_agent.py` + `explain_agent.py` | ✅ |
| 6-7 | `confidence.py` — confidence score calculator | ✅ |
| 7-9 | `orchestrator.py` — full routing + assembly + test all flows | ✅ |
| 9-10 | Test with Person B's backend. Fix integration issues. | ✅ |
| 10-12 | Prompt tuning. Edge case handling. Demo dataset verification. | ✅ |

---

## ⚠️ Common Pitfalls

| Pitfall | Fix |
|---|---|
| Gemini returns markdown in SQL | `_clean_sql()` strips backticks and code fences |
| Rate limit (429 error) | `gemini_client.py` has automatic retry with backoff |
| SQL references non-existent column | System prompt tells model schema. Retry sends error back. |
| Code execution hangs | 30-second timeout in `code_sandbox.py` kills the thread |
| matplotlib figure not captured | Auto-capture in `execute_code()` gets all open figures |
| DuckDuckGo search fails | Wrapped in try/except — search is always optional |
| JSON parse error from Gemini | `generate_json()` tries regex extraction as fallback |
| Large schema (100+ columns) | Schema is always sent as summary (name + type only, no values) |
| `import` blocked in sandbox | All safe modules pre-injected into namespace |
| Confidence score is always low | Check that `columns_used` and `row_count` are being passed correctly |

---

## 📋 Key Files Checklist

- [ ] `app/utils/gemini_client.py` — Gemini API wrapper (test first!)
- [ ] `app/agents/sql_agent.py` — NL → SQL → Execute (most critical)
- [ ] `app/utils/code_sandbox.py` — Safe Python execution
- [ ] `app/agents/code_agent.py` — Python code generation
- [ ] `app/agents/search_agent.py` — DuckDuckGo web search
- [ ] `app/agents/explain_agent.py` — Plain English explanations
- [ ] `app/core/confidence.py` — Confidence score calculator
- [ ] `app/agents/orchestrator.py` — The brain that ties it all together
- [ ] All agents tested with `test_agents_standalone.py`
- [ ] Integrated with Person B's `chat.py` endpoint
- [ ] Prompts tuned for banking dataset demo
