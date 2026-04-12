"""
POST /api/upload — File upload endpoint.
Parses CSV/Excel/JSON, loads into DuckDB, returns schema and data quality info.
"""
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Request

from app.core.file_handler import parse_upload
from app.core.preprocessor import detect_issues

router = APIRouter()


@router.post("/upload")
async def upload_file(request: Request, file: UploadFile = File(...)):
    """Upload a data file and run phase 1 preprocessing."""
    try:
        # Parse the file into a DataFrame
        df = await parse_upload(file)

        # Create session ID
        session_id = str(uuid.uuid4())

        # Phase 1: Auto-fixes and issue detection
        df, auto_results, medium_issues = detect_issues(df)

        # Temporarily store session data (Wait for /apply to initialize DuckDB)
        request.app.state.sessions[session_id] = {
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
