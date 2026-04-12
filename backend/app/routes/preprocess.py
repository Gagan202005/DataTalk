"""
POST /api/preprocess/apply — Apply approved fixes and load into DuckDB.
GET /api/preprocess/download/{session_id} — Download cleaned CSV.
"""
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import io

from app.core.preprocessor import apply_decisions, dataframe_to_csv_bytes
from app.core.database import DatabaseManager
from app.core.schema import extract_schema, assess_data_quality, suggest_metrics, detect_anomalies
from app.core.semantic_layer import SemanticLayerManager

router = APIRouter()

class ApplyRequest(BaseModel):
    session_id: str
    approved_step_ids: list[str]

@router.post("/preprocess/apply")
async def apply_preprocessing(request: ApplyRequest, req: Request):
    """Apply selected preprocessing steps and initialize chat session."""
    session_id = request.session_id
    if session_id not in req.app.state.sessions:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session_data = req.app.state.sessions[session_id]
    df = session_data.get("df_preprocessed")
    if df is None:
        df = session_data.get("df")
        
    if df is None:
        raise HTTPException(status_code=404, detail="Data not found for session")

    # Phase 2: Apply user decisions
    df, results = apply_decisions(df, request.approved_step_ids)
    
    # Initialize DuckDB
    db = DatabaseManager(session_id)
    db.load_dataframe(df, table_name="data")
    
    # Extract schema and metrics on cleaned data
    schema = extract_schema(df)
    quality = assess_data_quality(df)
    suggestions = suggest_metrics(df)
    anomalies = detect_anomalies(df)
    
    semantic = SemanticLayerManager()
    for s in suggestions:
        semantic.add_metric(s["name"], s["expression"], s["description"])
        
    # Update session with initialized state
    req.app.state.sessions[session_id] = {
        "db": db,
        "df": df,
        "schema": schema,
        "filename": session_data.get("filename", "unknown.csv"),
        "semantic_layer": semantic,
        "messages": [],
        "cache": {},
    }
    
    return {
        "session_id": session_id,
        "filename": session_data.get("filename", "unknown.csv"),
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
    """Download the cleaned DataFrame as a CSV file."""
    if session_id not in req.app.state.sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session_data = req.app.state.sessions[session_id]
    df = session_data.get("df")
    if df is None:
        # Fallback to preprocessed df if chat wasn't initialized
        df = session_data.get("df_preprocessed")

    if df is None:
        raise HTTPException(status_code=404, detail="Data not found")
        
    csv_bytes = dataframe_to_csv_bytes(df)
    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=cleaned_data.csv"}
    )
