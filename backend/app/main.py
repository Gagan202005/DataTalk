"""
DataTalk Backend — FastAPI Application Entry Point
Handles CORS, session management, and route mounting.
"""
import os
import sys
import uuid
import io
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Force UTF-8 on Windows stdout/stderr so emoji in print() never crashes the process
if sys.stdout and hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr and hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

load_dotenv()

# Import routes
from app.routes import upload, chat, semantic, export

# In-memory session store (metadata only — actual data is in .duckdb files)
sessions = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    os.makedirs("sessions", exist_ok=True)  # Ensure sessions dir exists on startup
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")  # Prevent cp1252 emoji crashes
    print("DataTalk Backend starting...")
    yield
    # Cleanup: close all DuckDB connections and delete session .duckdb files
    for sid in list(sessions.keys()):
        if "db" in sessions[sid]:
            try:
                sessions[sid]["db"].close()
                sessions[sid]["db"].delete_file()  # Remove .duckdb file from disk
            except Exception:
                pass
    sessions.clear()
    print("DataTalk Backend stopped.")


app = FastAPI(
    title="DataTalk API",
    description="AI-powered data analysis backend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routes
app.include_router(upload.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(semantic.router, prefix="/api")
app.include_router(export.router, prefix="/api")


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "sessions": len(sessions)}


@app.get("/api/debug-sandbox")
async def debug_sandbox():
    """Debug endpoint: run sandbox test inside server process and return result."""
    import pandas as pd
    from app.utils.code_sandbox import execute_code

    df = pd.DataFrame({"amount": [100, 200, 300, 400], "balance": [1000, 2000, 3000, 4000], "age": [25, 35, 45, 55]})
    code = """
import io
import base64
import matplotlib.pyplot as plt
import seaborn as sns

corr = df.select_dtypes(include="number").corr()
plt.figure(figsize=(6, 4))
sns.heatmap(corr, annot=True, cmap="coolwarm")
plt.title("Test Heatmap")

buf = io.BytesIO()
plt.savefig(buf, format="png", dpi=100, bbox_inches="tight", facecolor="#111827")
buf.seek(0)
_figures.append(base64.b64encode(buf.read()).decode())
plt.close()
print("sandbox ok")
"""
    result = execute_code(code, dataframe=df)
    return {
        "success": result.success,
        "figures_count": len(result.figures),
        "figure_length": len(result.figures[0]) if result.figures else 0,
        "error": result.error,
        "stderr": result.stderr[:300] if result.stderr else None,
        "stdout": result.stdout,
    }


# Make sessions accessible to routes via app.state
app.state.sessions = sessions
