"""
POST /api/chat — Main chat endpoint.
"""
import hashlib
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()


class ChatRequest(BaseModel):
    session_id: str
    question: str
    options: dict = {}
    mode: str = "auto"          # "auto" | "sql" | "analysis" | "compliance"
    web_search: bool = False     # user-toggled parallel web enrichment


@router.post("/chat")
async def chat(request: Request, body: ChatRequest):
    sessions = request.app.state.sessions

    if body.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found. Please upload a file first.")

    session = sessions[body.session_id]

    # Merge mode and web_search into options so orchestrator can read them
    merged_options = {
        **body.options,
        "mode": body.mode,
        "web_search": body.web_search,
    }

    # Cache key includes mode + web_search
    cache_str = body.question.lower().strip() + json.dumps(merged_options, sort_keys=True)
    cache_key = hashlib.md5(cache_str.encode()).hexdigest()
    cache = session.setdefault("cache", {})
    if cache_key in cache:
        cached = cache[cache_key].copy()
        cached["from_cache"] = True
        return cached

    try:
        from app.agents.orchestrator import process_question
        result = await process_question(
            question=body.question,
            session=session,
            options=merged_options,
        )
    except ImportError:
        result = _mock_response(body.question)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing question: {str(e)}")

    result["timestamp"] = datetime.now(timezone.utc).isoformat()
    result["from_cache"] = False

    if len(cache) < 20:
        cache[cache_key] = result

    messages = session.setdefault("messages", [])
    messages.append({"role": "user", "content": body.question, "timestamp": result["timestamp"]})
    messages.append({"role": "assistant", **result})

    return result


def _mock_response(question: str) -> dict:
    return {
        "answer": f"[MOCK] I received: '{question}'. AI agents not yet connected.",
        "agent_used": "mock",
        "sql_query": None, "python_code": None, "chart": None,
        "matplotlib_image": None,
        "confidence": {"score": 50, "level": "Medium", "breakdown": {}},
        "sources": [], "web_context": [], "compliance": {"status": "compliant", "annotations": []},
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "from_cache": False,
    }
