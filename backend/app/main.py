"""
DataTalk Backend — FastAPI Application Entry Point
"""
import os
import sys
import io
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

if sys.stdout and hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr and hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

load_dotenv()

from app.routes import upload, chat, semantic, export, preprocess
from app.routes import models as models_router
from app.routes import sample_data as sample_data_router
from app.routes import compliance as compliance_router

sessions = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.core.database import _SESSIONS_DIR
    os.makedirs(_SESSIONS_DIR, exist_ok=True)
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

    # Initialize compliance knowledge base
    from app.core.compliance_kb import get_compliance_kb
    kb = get_compliance_kb()
    docs_dir = os.path.join(os.path.dirname(__file__), "compliance_docs")
    n_chunks = kb.load_documents(docs_dir)
    app.state.compliance_kb = kb
    print(f"DataTalk Backend starting... Compliance KB: {n_chunks} chunks loaded from {docs_dir}")

    yield

    for sid in list(sessions.keys()):
        if "db" in sessions[sid]:
            try:
                sessions[sid]["db"].close()
                sessions[sid]["db"].delete_file()
            except Exception:
                pass
    sessions.clear()
    print("DataTalk Backend stopped.")


app = FastAPI(
    title="DataTalk API",
    description="AI-powered financial analyst copilot",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api")
app.include_router(preprocess.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(semantic.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(models_router.router, prefix="/api")
app.include_router(sample_data_router.router, prefix="/api")
app.include_router(compliance_router.router, prefix="/api")


@app.get("/api/health")
async def health_check():
    from app.core.compliance_kb import get_compliance_kb
    kb = get_compliance_kb()
    return {
        "status": "ok",
        "sessions": len(sessions),
        "compliance_kb_loaded": kb.is_loaded,
        "compliance_chunks": len(kb.chunks) if kb.is_loaded else 0,
    }


@app.get("/api/debug-sandbox")
async def debug_sandbox():
    import pandas as pd
    from app.utils.code_sandbox import execute_code
    df = pd.DataFrame({"amount": [100, 200, 300, 400], "balance": [1000, 2000, 3000, 4000]})
    code = """
import io, base64, matplotlib.pyplot as plt
plt.figure(figsize=(6,4))
plt.bar(["Q1","Q2","Q3","Q4"], df["amount"].tolist())
buf = io.BytesIO()
plt.savefig(buf, format="png", dpi=100, bbox_inches="tight", facecolor="#111827")
buf.seek(0)
_figures.append(base64.b64encode(buf.read()).decode())
plt.close()
print("sandbox ok")
"""
    result = execute_code(code, dataframe=df)
    return {"success": result.success, "figures_count": len(result.figures), "error": result.error}


app.state.sessions = sessions
