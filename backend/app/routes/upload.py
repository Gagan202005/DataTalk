"""
POST /api/upload — File upload endpoint.
Parses CSV/Excel/JSON, loads into DuckDB, returns schema and data quality info.
"""
import uuid
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request

from app.core.file_handler import parse_upload
from app.core.preprocessor import detect_issues

router = APIRouter()


@router.post("/upload")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(default=None),
):
    """Upload a data file and run phase 1 preprocessing.

    If session_id is provided and the session exists, the new file is queued
    for preprocessing into that existing session (multi-table flow).
    Otherwise a fresh session is created.
    """
    try:
        # Parse the file into a DataFrame
        df = await parse_upload(file)

        # Phase 1: Auto-fixes and issue detection
        df, auto_results, medium_issues = detect_issues(df)

        sessions = request.app.state.sessions

        # Reuse existing session if provided and valid, otherwise create new
        if session_id and session_id in sessions:
            # Add pending file to existing session (one at a time — wizard enforces this)
            sessions[session_id]["df_preprocessed"] = df
            sessions[session_id]["pending_filename"] = file.filename
        else:
            # New session
            session_id = str(uuid.uuid4())
            sessions[session_id] = {
                "df_preprocessed": df,
                "filename": file.filename,
            }

        return {
            "temp_id": session_id,
            "filename": file.filename,
            "row_count": len(df),
            "column_count": len(df.columns),
            "auto_fixes": auto_results,
            "issues": medium_issues,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
