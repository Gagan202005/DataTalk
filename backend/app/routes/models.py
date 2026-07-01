"""
GET  /api/models/available — list available model use cases
POST /api/models/run       — run inference on session data
"""
import uuid
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Dict, Any

router = APIRouter()


class RunModelsRequest(BaseModel):
    session_id: str
    use_case: str
    models_selected: List[str]
    column_mapping: Dict[str, str] = {}


@router.get("/models/available")
async def get_available_models(request: Request, session_id: str = None):
    from app.agents.model_agent import get_available_use_cases
    use_cases = get_available_use_cases()
    return {"use_cases": use_cases}


@router.post("/models/run")
async def run_models(request: Request, body: RunModelsRequest):
    sessions = request.app.state.sessions
    if body.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")

    session = sessions[body.session_id]
    tables = session.get("tables", {})
    if not tables:
        raise HTTPException(status_code=400, detail="No data loaded in session.")

    # Use first table's DataFrame
    first_table = next(iter(tables.values()))
    df = first_table.get("df")
    schema = first_table.get("schema", [])

    if df is None:
        raise HTTPException(status_code=400, detail="No DataFrame available in session.")

    from app.agents.model_agent import run_inference, auto_map_columns, USE_CASES

    # Auto-map columns if not provided
    column_mapping = body.column_mapping
    if not column_mapping:
        info = USE_CASES.get(body.use_case, {})
        column_mapping = auto_map_columns(schema, info.get("required_features", []))

    try:
        result = run_inference(
            use_case=body.use_case,
            models_selected=body.models_selected,
            column_mapping=column_mapping,
            df=df,
            schema=schema,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model inference failed: {str(e)}")

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    run_id = str(uuid.uuid4())[:8]
    result["run_id"] = run_id
    return result
