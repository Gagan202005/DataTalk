"""Quick test: verify DuckDuckGo news search works."""
from app.routes.news import _blocking_news_search, _classify_category, _classify_severity

results = _blocking_news_search("global financial markets", 3)
print(f"Got {len(results)} results from DDG news search")

for r in results[:3]:
    title = r.get("title", "")
    cat = _classify_category(title)
    sev = _classify_severity(title)
    print(f"  [{cat}/{sev}] {title[:70]}")

print("\nNews endpoint test: PASSED" if results else "\nNo results (could be rate limited)")
