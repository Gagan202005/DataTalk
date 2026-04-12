"""
POST /api/upload — File upload endpoint.
Parses CSV/Excel/JSON, loads into DuckDB, returns schema and data quality info.
"""
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Request

from app.core.file_handler import parse_upload
from app.core.database import DatabaseManager
from app.core.schema import extract_schema, assess_data_quality, suggest_metrics, detect_anomalies
from app.core.semantic_layer import SemanticLayerManager

router = APIRouter()


@router.post("/upload")
async def upload_file(request: Request, file: UploadFile = File(...)):
    """Upload a data file and create a new analysis session."""
    try:
        # Parse the file into a DataFrame
        df = await parse_upload(file)

        # Create session ID
        session_id = str(uuid.uuid4())

        # Create DuckDB database (persistent .duckdb file) and load data
        db = DatabaseManager(session_id)
        db.load_dataframe(df, table_name="data")

        # Extract schema and quality info
        schema = extract_schema(df)
        quality = assess_data_quality(df)
        suggestions = suggest_metrics(df)
        anomalies = detect_anomalies(df)

        # Create semantic layer with auto-suggested metrics
        semantic = SemanticLayerManager()
        for s in suggestions:
            semantic.add_metric(s["name"], s["expression"], s["description"])

        # Store session metadata
        request.app.state.sessions[session_id] = {
            "db": db,
            "df": df,
            "schema": schema,
            "filename": file.filename,
            "semantic_layer": semantic,
            "messages": [],
            "cache": {},  # Q&A response cache
        }

        return {
            "session_id": session_id,
            "filename": file.filename,
            "row_count": len(df),
            "column_count": len(df.columns),
            "schema": schema,
            "data_quality": quality,
            "suggested_metrics": suggestions,
            "anomalies": anomalies,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
