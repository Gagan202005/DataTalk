"""
DataTalk Python Sidecar — loopback-only FastAPI on port 8090.
Exposes two capabilities that have no viable JS replacement:
  1. /infer/{use_case}   — sklearn .joblib model inference + matplotlib charts
  2. /execute-code       — sandboxed Python execution (pandas / matplotlib / scipy)

Frontend never talks here. Only Node Express on :8080 calls these endpoints.
"""
import os
import sys
import io
import json
import base64
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

# Ensure UTF-8 output on Windows
if sys.stdout and hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr and hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import pandas as pd
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── import local modules ───────────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))
from code_sandbox import execute_code
from model_agent import (
    run_inference,
    get_available_use_cases,
    auto_map_columns,
)

app = FastAPI(title="DataTalk Sidecar", version="1.0.0")

# Only loopback should reach this, but CORS is harmless here
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://127.0.0.1:8080"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── /health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "sidecar"}


# ── /execute-code ──────────────────────────────────────────────────────────────

class ExecuteCodeRequest(BaseModel):
    code: str
    session_id: Optional[str] = None
    rows: Optional[List[Dict[str, Any]]] = None   # JSON rows → dataframe
    timeout_s: Optional[int] = 30


class Artifact(BaseModel):
    type: str   # "image"
    b64: str


class ExecuteCodeResponse(BaseModel):
    stdout: str
    stderr: str
    result_json: Optional[Any] = None
    artifacts: List[Artifact] = []
    error: Optional[str] = None
    success: bool


@app.post("/execute-code", response_model=ExecuteCodeResponse)
def execute_code_endpoint(req: ExecuteCodeRequest):
    df = pd.DataFrame(req.rows) if req.rows else pd.DataFrame()
    result = execute_code(req.code, dataframe=df if not df.empty else None)
    artifacts = [Artifact(type="image", b64=fig) for fig in result.figures]
    return ExecuteCodeResponse(
        stdout=result.stdout,
        stderr=result.stderr,
        artifacts=artifacts,
        error=result.error,
        success=result.success,
    )


# ── /run-inference ─────────────────────────────────────────────────────────────

class InferRequest(BaseModel):
    use_case: str
    models_selected: List[str] = []
    column_mapping: Dict[str, str] = {}
    schema: List[Dict[str, Any]] = []
    rows: Optional[List[Dict[str, Any]]] = None


@app.post("/run-inference")
def run_inference_endpoint(req: InferRequest):
    df = pd.DataFrame(req.rows) if req.rows else pd.DataFrame()
    try:
        result = run_inference(
            use_case=req.use_case,
            models_selected=req.models_selected,
            column_mapping=req.column_mapping,
            df=df,
            schema=req.schema,
        )
        return result
    except Exception as e:
        import traceback
        return {"error": f"Sidecar execution failed: {str(e)}\n{traceback.format_exc()}"}


# ── /use-cases ─────────────────────────────────────────────────────────────────

@app.get("/use-cases")
def use_cases():
    return {"use_cases": get_available_use_cases()}


# ── entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8090,
        workers=1,
        log_level="info",
    )
