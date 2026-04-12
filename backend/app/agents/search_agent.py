"""
Search Agent: Web search for contextual information using DuckDuckGo.
No API key required — completely free.
"""
import asyncio
from duckduckgo_search import DDGS
from typing import Optional


def _blocking_search(query: str, max_results: int, time_filter: Optional[str]) -> list:
    """Run DuckDuckGo search synchronously (called via run_in_executor)."""
    with DDGS() as ddgs:
        kwargs = {"max_results": max_results}
        if time_filter:
            kwargs["timelimit"] = time_filter
        return list(ddgs.text(query, **kwargs))


async def run_search_agent(
    query: str,
    max_results: int = 5,
    time_filter: Optional[str] = None,
) -> dict:
    """
    Search the web for contextual information.

    Args:
        query: Search query string.
        max_results: Maximum number of results to return.
        time_filter: Optional time filter ('d'=day, 'w'=week, 'm'=month, 'y'=year).

    Returns:
        Dict with search_results list and search_query.
    """
    try:
        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(
            None, _blocking_search, query, max_results, time_filter
        )

        # Format results
        formatted = []
        for r in results:
            formatted.append({
                "title": r.get("title", ""),
                "snippet": r.get("body", ""),
                "url": r.get("href", ""),
            })

        return {
            "search_query": query,
            "results": formatted,
            "count": len(formatted),
        }

    except Exception as e:
        # Web search is optional — always fail gracefully
        print(f"⚠️ Web search failed: {e}")
        return {
            "search_query": query,
            "results": [],
            "count": 0,
            "error": str(e),
        }


def build_search_query(question: str, context: str = "") -> str:
    """
    Build an effective search query from the user's question.
    Adds relevant context keywords for better results.
    """
    banking_keywords = ["bank", "finance", "market", "economy", "trading", "investment"]
    has_context = any(kw in question.lower() for kw in banking_keywords)

    if not has_context and context:
        return f"{question} {context} banking finance trends"
    elif not has_context:
        return f"{question} banking industry trends"
    return question
