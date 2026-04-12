"""
POST /api/preprocess/apply — Apply approved fixes and load into DuckDB.
GET /api/preprocess/download/{session_id} — Download cleaned CSV.
"""
import re
from typing import Optional
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import io

from app.core.preprocessor import apply_decisions, dataframe_to_csv_bytes
from app.core.database import DatabaseManager
from app.core.schema import extract_schema, assess_data_quality, suggest_metrics, detect_anomalies
from app.core.semantic_layer import SemanticLayerManager

router = APIRouter()

# SQL reserved words that cannot be used as table names unquoted
_SQL_RESERVED = {
    "order", "group", "table", "select", "where", "from", "join", "index",
    "data", "values", "key", "column", "columns", "row", "rows", "update",
    "insert", "delete", "create", "drop", "alter", "view", "set", "by",
    "in", "is", "as", "on", "and", "or", "not", "null", "true", "false",
}


def _sanitize_table_name(filename: str, existing_names: set) -> str:
    """Derive a safe DuckDB table name from a filename.

    Rules:
    - Strip file extension
    - Lowercase, replace spaces/hyphens with underscores
    - Remove non-alphanumeric chars (except underscores)
    - Prefix with 'tbl_' if result is a SQL reserved word or starts with a digit
    - Append '_2', '_3', etc. if the name is already taken
    """
    name = re.sub(r"\.[^.]+$", "", filename)        # strip extension
    name = name.lower().strip()
    name = re.sub(r"[\s\-]+", "_", name)             # spaces/hyphens → underscore
    name = re.sub(r"[^\w]", "", name)                # remove non-word chars
    name = re.sub(r"_+", "_", name).strip("_")       # collapse multiple underscores

    if not name:
        name = "table"

    # Prefix reserved words or names starting with a digit
    if name in _SQL_RESERVED or name[0].isdigit():
        name = f"tbl_{name}"

    # Handle duplicates by appending numeric suffix
    base = name
    counter = 2
    while name in existing_names:
        name = f"{base}_{counter}"
        counter += 1

    return name


class ApplyRequest(BaseModel):
    session_id: str
    approved_step_ids: list[str]
    table_name: Optional[str] = None   # if None, derived from filename


@router.post("/preprocess/apply")
async def apply_preprocessing(request: ApplyRequest, req: Request):
    """Apply selected preprocessing steps and load into DuckDB.

    First file: creates a fresh session with tables dict + new DuckDB.
    Subsequent files: reuses existing session's DuckDB and appends new table.
    """
    session_id = request.session_id
    sessions = req.app.state.sessions

    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session_data = sessions[session_id]
    df = session_data.get("df_preprocessed")
    if df is None:
        raise HTTPException(status_code=404, detail="No pending data found for session")

    # Phase 2: Apply user decisions
    df, results = apply_decisions(df, request.approved_step_ids)

    # Determine filename (pending_filename set by upload.py for 2nd+ files)
    filename = session_data.get("pending_filename") or session_data.get("filename", "unknown.csv")

    # Resolve table name
    is_existing_session = "tables" in session_data  # True for 2nd+ files
    existing_names = set(session_data["tables"].keys()) if is_existing_session else set()

    table_name = request.table_name or _sanitize_table_name(filename, existing_names)

    # Extract schema and metrics
    schema = extract_schema(df)
    quality = assess_data_quality(df)
    suggestions = suggest_metrics(df)
    anomalies = detect_anomalies(df)

    if is_existing_session:
        # --- ADD table to existing session ---
        db = session_data["db"]
        db.load_dataframe(df, table_name=table_name)

        # Append new metrics to shared semantic layer (avoid duplicates)
        semantic = session_data["semantic_layer"]
        existing_metric_names = {m["name"] for m in semantic.get_metrics()}
        for s in suggestions:
            if s["name"] not in existing_metric_names:
                semantic.add_metric(s["name"], s["expression"], s["description"])

        # Store per-table metadata
        session_data["tables"][table_name] = {
            "df": df,
            "schema": schema,
            "data_quality": quality,
            "anomalies": anomalies,
            "filename": filename,
        }

        # Clear pending upload keys
        session_data.pop("df_preprocessed", None)
        session_data.pop("pending_filename", None)

    else:
        # --- FIRST file: initialize session fully ---
        db = DatabaseManager(session_id)
        db.load_dataframe(df, table_name=table_name)

        semantic = SemanticLayerManager()
        for s in suggestions:
            semantic.add_metric(s["name"], s["expression"], s["description"])

        sessions[session_id] = {
            "db": db,
            "tables": {
                table_name: {
                    "df": df,
                    "schema": schema,
                    "data_quality": quality,
                    "anomalies": anomalies,
                    "filename": filename,
                }
            },
            "semantic_layer": semantic,
            "messages": [],
            "cache": {},
        }

    return {
        "session_id": session_id,
        "table_name": table_name,
        "filename": filename,
        "row_count": len(df),
        "column_count": len(df.columns),
        "schema": schema,
        "data_quality": quality,
        "suggested_metrics": suggestions,
        "anomalies": anomalies,
        "preprocessing_report": results,
    }


@router.get("/preprocess/download/{session_id}")
async def download_cleaned_data(session_id: str, req: Request):
    """Download the first table's cleaned DataFrame as a CSV file."""
    if session_id not in req.app.state.sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session_data = req.app.state.sessions[session_id]

    # Try tables dict first (post-apply), fall back to pending df (pre-apply)
    tables = session_data.get("tables", {})
    if tables:
        df = next(iter(tables.values()))["df"]
    else:
        df = session_data.get("df_preprocessed")

    if df is None:
        raise HTTPException(status_code=404, detail="Data not found")

    csv_bytes = dataframe_to_csv_bytes(df)
    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=cleaned_data.csv"}
    )
