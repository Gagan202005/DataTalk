"""
POST /api/export-pdf — Generate and stream a PDF report of the Q&A session.
"""
import io
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

router = APIRouter()

class TemplateInfo(BaseModel):
    author: Optional[str] = None
    company: Optional[str] = None
    date: Optional[str] = None
    executive_summary: Optional[str] = None

class Attachment(BaseModel):
    message_index: Optional[int] = None
    data: str  # Base64 string
    content_type: str = "image/png"

class ExportRequest(BaseModel):
    session_id: str
    messages: List[Dict[str, Any]]
    template_info: Optional[TemplateInfo] = None
    attachments: Optional[List[Attachment]] = None


@router.post("/export-pdf")
async def export_pdf(request: Request, body: ExportRequest):
    """Generate a PDF report of the Q&A session and return as a download."""
    sessions = request.app.state.sessions
    if body.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")

    try:
        from app.utils.pdf_generator import generate_pdf_report

        session = sessions[body.session_id]

        # Build tables info from new multi-table session structure
        tables = session.get("tables", {})

        template_info_dict = body.template_info.model_dump() if body.template_info else None
        attachments_list = [att.model_dump() for att in body.attachments] if body.attachments else None

        pdf_bytes = generate_pdf_report(
            messages=body.messages,
            tables=tables,
            semantic_layer=session.get("semantic_layer"),
            template_info=template_info_dict,
            attachments=attachments_list,
        )

        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=DataTalk_Report.pdf"
            },
        )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"PDF generation failed: {str(e)}"
        )
