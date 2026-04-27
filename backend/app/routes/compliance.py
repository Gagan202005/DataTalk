"""
GET  /api/compliance/documents — list loaded compliance docs
POST /api/compliance/query     — direct compliance question (no data agent)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()


class ComplianceQueryRequest(BaseModel):
    question: str
    session_id: str | None = None


@router.get("/compliance/documents")
async def list_compliance_documents(request: Request):
    from app.core.compliance_kb import get_compliance_kb
    kb = get_compliance_kb()
    if not kb.is_loaded:
        return {"documents": [], "loaded": False}
    return {"documents": kb.list_documents(), "loaded": True, "total_chunks": len(kb.chunks)}


@router.post("/compliance/query")
async def compliance_query(request: Request, body: ComplianceQueryRequest):
    from app.agents.compliance_agent import answer_compliance_question
    try:
        result = await answer_compliance_question(body.question, schema=None)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compliance query failed: {str(e)}")
