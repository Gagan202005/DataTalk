"""
GET  /api/sample-datasets       — list available sample datasets
POST /api/sample-datasets/load  — load a sample dataset into a new session
"""
import os
import uuid
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()

SAMPLE_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "sample_data")

SAMPLE_DATASETS = [
    {
        "id": "loan_portfolio",
        "name": "Loan Portfolio",
        "description": "5,000 synthetic bank loans with NPA analysis, PSL tracking, and stress testing scenarios",
        "filename": "loan_portfolio.csv",
        "rows": 5000,
        "tags": ["NPA", "PSL", "Credit Risk", "Stress Test"],
        "icon": "building-2",
    },
    {
        "id": "transactions",
        "name": "Transaction Ledger",
        "description": "50,000 banking transactions with AML patterns, CTR triggers, and structuring examples",
        "filename": "transactions.csv",
        "rows": 50000,
        "tags": ["AML", "PMLA", "Fraud", "CTR"],
        "icon": "credit-card",
    },
    {
        "id": "customers",
        "name": "Customer Base",
        "description": "10,000 bank customers with churn signals, segmentation patterns, and product data",
        "filename": "customers.csv",
        "rows": 10000,
        "tags": ["Churn", "Segmentation", "CRM"],
        "icon": "users",
    },
]


class LoadDatasetRequest(BaseModel):
    dataset_id: str
    session_id: str | None = None


@router.get("/sample-datasets")
async def list_sample_datasets():
    result = []
    for ds in SAMPLE_DATASETS:
        fpath = os.path.join(SAMPLE_DATA_DIR, ds["filename"])
        result.append({**ds, "available": os.path.exists(fpath)})
    return {"datasets": result}


@router.post("/sample-datasets/load")
async def load_sample_dataset(request: Request, body: LoadDatasetRequest):
    sessions = request.app.state.sessions

    ds_info = next((d for d in SAMPLE_DATASETS if d["id"] == body.dataset_id), None)
    if not ds_info:
        raise HTTPException(status_code=404, detail=f"Sample dataset '{body.dataset_id}' not found.")

    fpath = os.path.join(SAMPLE_DATA_DIR, ds_info["filename"])
    if not os.path.exists(fpath):
        raise HTTPException(
            status_code=404,
            detail=f"Dataset file not found. Run the generator script first: python -m app.synthetic_data.generate_{body.dataset_id}"
        )

    import pandas as pd
    from app.core.file_handler import parse_dataframe
    from app.core.preprocessor import detect_issues

    try:
        df = pd.read_csv(fpath)
        df, auto_fixes, medium_issues = detect_issues(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load dataset: {str(e)}")

    session_id = body.session_id or str(uuid.uuid4())
    if session_id not in sessions:
        sessions[session_id] = {
            "tables": {},
            "messages": [],
            "cache": {},
        }

    # Store as temp pending preprocessing
    sessions[session_id]["df_preprocessed"] = df
    sessions[session_id]["pending_filename"] = ds_info["filename"]
    sessions[session_id]["pending_temp_id"] = session_id

    return {
        "temp_id": session_id,
        "session_id": session_id,
        "filename": ds_info["filename"],
        "row_count": len(df),
        "column_count": len(df.columns),
        "auto_fixes": auto_fixes,
        "issues": medium_issues,
        "dataset_info": ds_info,
    }
