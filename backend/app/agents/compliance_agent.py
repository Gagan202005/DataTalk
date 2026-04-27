"""
Compliance Agent — three modes:
1. pre_screen(question): blocks PII queries before any agent runs
2. post_validate(question, data, schema): annotates responses with compliance findings
3. answer_compliance_question(question, schema): RAG-based policy Q&A
"""
from typing import List, Dict, Any
from app.core.compliance_rules import check_pii_query, run_all_applicable_rules
from app.core.compliance_kb import get_compliance_kb
from app.utils.gemini_client import gemini


COMPLIANCE_QA_PROMPT = """You are a banking compliance expert. Answer the user's question using ONLY the regulatory excerpts provided below.

Rules:
- Cite the source document name for every key point
- Use plain English, no legal jargon unless necessary
- If the excerpts don't contain enough information, say so clearly
- Format your answer in markdown with bullet points for key rules
- End with a "Compliance Action Required:" line if the finding requires immediate action

Regulatory excerpts:
{context}

User question: {question}
"""


def pre_screen(question: str) -> Dict | None:
    """
    Check if the question should be blocked before any agent runs.
    Returns a block response dict if blocked, None if the question is clean.
    """
    block = check_pii_query(question)
    if block:
        return {
            "answer": f"🔴 **{block['message']}**",
            "agent_used": "compliance_agent",
            "compliance": {
                "status": "blocked",
                "annotations": [block],
            },
            "sql_query": None,
            "python_code": None,
            "chart": None,
            "matplotlib_image": None,
            "data": [],
            "confidence": {"score": 0, "level": "Low", "breakdown": {}},
            "sources": [],
            "suggestions": [],
            "from_cache": False,
        }
    return None


def post_validate(question: str, data: List[Dict], schema: List[Dict] = None) -> Dict:
    """
    Run deterministic compliance rules against the result data.
    Returns: {"status": "compliant"|"warning"|"blocked", "annotations": [...]}
    """
    annotations = run_all_applicable_rules(question, data)

    if not annotations:
        return {
            "status": "compliant",
            "annotations": [{
                "rule": "GENERAL",
                "status": "compliant",
                "message": "No compliance issues detected for this analysis.",
            }],
        }

    has_warning = any(a["status"] == "warning" for a in annotations)
    overall = "warning" if has_warning else "compliant"
    return {"status": overall, "annotations": annotations}


async def answer_compliance_question(question: str, schema: List[Dict] = None) -> Dict:
    """
    RAG-based compliance Q&A: retrieve relevant policy chunks + Gemini explanation.
    Used when mode == "compliance".
    """
    kb = get_compliance_kb()
    if not kb.is_loaded:
        return {
            "answer": (
                "⚠️ Compliance knowledge base is not loaded. "
                "Please ensure compliance policy documents are present in the compliance_docs directory."
            ),
            "agent_used": "compliance_agent",
            "compliance": {"status": "warning", "annotations": []},
            "sql_query": None,
            "python_code": None,
            "chart": None,
            "matplotlib_image": None,
            "data": [],
            "confidence": {"score": 30, "level": "Low", "breakdown": {}},
            "sources": [],
            "suggestions": [],
            "from_cache": False,
        }

    # Retrieve relevant policy chunks
    chunks = kb.retrieve(question, top_k=4)
    if not chunks:
        return {
            "answer": "I couldn't find relevant regulatory information for this question in the loaded policy documents.",
            "agent_used": "compliance_agent",
            "compliance": {"status": "compliant", "annotations": []},
            "sql_query": None,
            "python_code": None,
            "chart": None,
            "matplotlib_image": None,
            "data": [],
            "confidence": {"score": 40, "level": "Low", "breakdown": {}},
            "sources": [],
            "suggestions": [],
            "from_cache": False,
        }

    context = "\n\n---\n\n".join(
        f"[Source: {c['title']}]\n{c['text']}" for c in chunks
    )

    prompt = COMPLIANCE_QA_PROMPT.format(context=context, question=question)

    try:
        answer = await gemini.generate(prompt=prompt, temperature=0.2)
    except Exception as e:
        answer = f"Error generating compliance answer: {str(e)}"

    sources = [
        {"type": "policy", "value": c["title"], "url": ""}
        for c in chunks
    ]

    confidence_score = min(95, int(max(c["score"] for c in chunks) * 100) + 50)

    return {
        "answer": answer,
        "agent_used": "compliance_agent",
        "compliance": {
            "status": "compliant",
            "annotations": [{
                "rule": "POLICY_QA",
                "status": "compliant",
                "message": f"Answer retrieved from: {', '.join(c['title'] for c in chunks[:2])}",
            }],
        },
        "sql_query": None,
        "python_code": None,
        "chart": None,
        "matplotlib_image": None,
        "data": [],
        "confidence": {
            "score": confidence_score,
            "level": "High" if confidence_score >= 75 else "Medium",
            "breakdown": {
                "row_coverage": 0,
                "data_completeness": 100,
                "schema_match": 0,
                "web_corroboration": 0,
                "compliance_check": confidence_score,
            },
        },
        "sources": sources,
        "suggestions": [
            "What are the provisioning requirements for NPA accounts?",
            "What is the PSL target for agriculture?",
            "What transactions require a Suspicious Transaction Report?",
        ],
        "from_cache": False,
    }
