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
2. plt.style.use('dark_background') is already set — just create charts.
3. `io`, `base64`, `pd`, `np`, `plt`, `sns`, `df`, and `_figures` are all pre-defined — do NOT import them again.
4. For EVERY chart you create, save it to `_figures` like this:
   buf = io.BytesIO()
   plt.savefig(buf, format='png', dpi=150, bbox_inches='tight', facecolor='#111827', edgecolor='none')
   buf.seek(0)
   _figures.append(base64.b64encode(buf.read()).decode())
   plt.close()
5. NEVER call plt.show() — it does nothing in this environment. Always use the savefig pattern above.
6. Use a professional color palette: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899']
7. Set appropriate figure size: plt.figure(figsize=(10, 6))
8. Add titles, labels, and legends to all charts.
9. Handle missing values gracefully (dropna or fillna).
10. Print the final answer clearly using print().
11. Format numbers nicely (commas, 2 decimal places where needed).
12. Output ONLY Python code — no markdown, no backticks, no explanation.

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
        Dict with python_code, stdout, matplotlib_images, error.
    """
    df = session["df"]
    schema = session["schema"]

    schema_str = json.dumps(schema, indent=2)
    system_prompt = CODE_SYSTEM_PROMPT.format(schema=schema_str)

    # Include basic stats about the dataframe
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
