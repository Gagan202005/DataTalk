"""
News Route: Fetches real-time financial news and market data.
Uses Gemini AI to intelligently analyze ANY uploaded dataset and generate
targeted news queries covering the full environment around that data.
Uses DuckDuckGo (already in requirements) — no API key needed for search.
"""
import asyncio
import time
import json
import random
from fastapi import APIRouter, Query
from duckduckgo_search import DDGS
from typing import Optional

router = APIRouter()

# ── In-memory cache ─────────────────────────────────────────────────────────
_news_cache: dict = {"data": None, "ts": 0, "key": ""}
_market_cache: dict = {"data": None, "ts": 0}
_query_cache: dict = {"queries": None, "ts": 0, "key": ""}
NEWS_TTL = 300        # 5 minutes
MARKET_TTL = 300      # 5 minutes

# ── Default queries when no dataset is loaded (broad financial coverage) ────
DEFAULT_QUERIES = [
    "global financial markets news today",
    "stock market S&P 500 Nasdaq today",
    "oil gold commodity prices news",
    "central bank interest rate decision",
    "cryptocurrency bitcoin ethereum news",
    "forex dollar euro currency news",
    "banking fintech digital payments news",
    "international trade tariffs economy",
]

# ── Geocoding lookup ────────────────────────────────────────────────────────
LOCATION_COORDS = {
    "india": (20.5937, 78.9629), "usa": (39.8283, -98.5795),
    "united states": (39.8283, -98.5795), "america": (39.8283, -98.5795),
    "uk": (55.3781, -3.4360), "united kingdom": (55.3781, -3.4360),
    "britain": (55.3781, -3.4360), "england": (51.5074, -0.1278),
    "china": (35.8617, 104.1954), "japan": (36.2048, 138.2529),
    "germany": (51.1657, 10.4515), "france": (46.6034, 1.8883),
    "australia": (-25.2744, 133.7751), "brazil": (-14.2350, -51.9253),
    "canada": (56.1304, -106.3468), "mexico": (23.6345, -102.5528),
    "singapore": (1.3521, 103.8198), "hong kong": (22.3193, 114.1694),
    "dubai": (25.2048, 55.2708), "uae": (23.4241, 53.8478),
    "saudi": (23.8859, 45.0792), "saudi arabia": (23.8859, 45.0792),
    "south korea": (35.9078, 127.7669), "korea": (35.9078, 127.7669),
    "russia": (61.5240, 105.3188), "europe": (54.5260, 15.2551),
    "new york": (40.7128, -74.006), "wall street": (40.7060, -74.0089),
    "london": (51.5074, -0.1278), "tokyo": (35.6762, 139.6503),
    "mumbai": (19.0760, 72.8777), "delhi": (28.7041, 77.1025),
    "bangalore": (12.9716, 77.5946), "bengaluru": (12.9716, 77.5946),
    "hyderabad": (17.3850, 78.4867), "chennai": (13.0827, 80.2707),
    "kolkata": (22.5726, 88.3639), "pune": (18.5204, 73.8567),
    "beijing": (39.9042, 116.4074), "shanghai": (31.2304, 121.4737),
    "washington": (38.9072, -77.0369), "frankfurt": (50.1109, 8.6821),
    "sydney": (-33.8688, 151.2093), "toronto": (43.6532, -79.3832),
    "zurich": (47.3769, 8.5417), "switzerland": (46.8182, 8.2275),
    "paris": (48.8566, 2.3522), "amsterdam": (52.3676, 4.9041),
    "tel aviv": (32.0853, 34.7818), "israel": (31.0461, 34.8516),
    "iran": (32.4279, 53.6880), "iraq": (33.2232, 43.6793),
    "taiwan": (23.6978, 120.9605), "vietnam": (14.0583, 108.2772),
    "indonesia": (-0.7893, 113.9213), "malaysia": (4.2105, 101.9758),
    "thailand": (15.8700, 100.9925), "philippines": (12.8797, 121.7740),
    "nigeria": (9.0820, 8.6753), "south africa": (-30.5595, 22.9375),
    "egypt": (26.8206, 30.8025), "turkey": (38.9637, 35.2433),
    "italy": (41.8719, 12.5674), "spain": (40.4637, -3.7492),
    "argentina": (-38.4161, -63.6167), "chile": (-35.6751, -71.5430),
    "global": (20.0, 0.0), "world": (20.0, 0.0),
    # Indian regions
    "north": (28.7041, 77.1025), "south": (13.0827, 80.2707),
    "east": (22.5726, 88.3639), "west": (19.0760, 72.8777),
}

# ── Category classifiers ────────────────────────────────────────────────────
CATEGORY_KEYWORDS = {
    "Commodities": ["oil", "crude", "gold", "silver", "wheat", "corn", "gas", "metal",
                     "commodity", "copper", "iron", "platinum", "palladium", "coal",
                     "lithium", "nickel", "aluminum", "zinc", "cotton", "soybean",
                     "coffee", "sugar", "cocoa", "lumber", "uranium"],
    "Central Bank": ["fed", "rbi", "ecb", "boj", "boe", "pboc", "central bank",
                     "monetary policy", "inflation", "interest rate", "reserve bank",
                     "quantitative", "tightening", "easing", "dovish", "hawkish"],
    "Crypto": ["bitcoin", "crypto", "ethereum", "blockchain", "btc", "defi", "nft",
               "stablecoin", "solana", "ripple", "xrp", "web3", "token", "mining"],
    "FX": ["forex", "dollar", "euro", "yen", "rupee", "currency", "exchange rate",
            "fx", "usd", "gbp", "yuan", "renminbi", "dxy", "pound"],
    "Banking": ["bank", "loan", "credit", "deposit", "atm", "npa", "fintech", "upi",
                "mortgage", "lending", "savings", "checking", "jpmorgan", "goldman",
                "citi", "hsbc", "barclays", "natwest", "rbi", "sbi"],
    "Trade": ["trade", "tariff", "export", "import", "supply chain", "sanctions",
              "wto", "trade war", "customs", "quota", "embargo"],
    "Tech": ["tech", "ai", "artificial intelligence", "nvidia", "apple", "google",
             "microsoft", "amazon", "meta", "semiconductor", "chip", "saas", "cloud"],
    "Energy": ["solar", "wind", "renewable", "nuclear", "power", "electricity",
               "energy transition", "ev", "electric vehicle", "battery", "grid"],
    "Real Estate": ["real estate", "housing", "property", "mortgage", "reit",
                    "construction", "rent", "commercial property"],
    "Healthcare": ["pharma", "healthcare", "biotech", "fda", "drug", "vaccine",
                   "hospital", "medical", "clinical trial"],
    "Markets": [],  # default fallback
}

SEVERITY_KEYWORDS = {
    "critical": ["crash", "plunge", "surge", "record", "crisis", "collapse", "war",
                 "default", "emergency", "breaks", "plummet", "soar", "skyrocket",
                 "unprecedented", "historic", "worst", "best", "all-time"],
    "warning": ["fall", "rise", "drop", "cut", "hike", "volatile", "warn", "risk",
                "concern", "slip", "miss", "decline", "tumble", "rally", "spike",
                "uncertainty", "fear", "caution", "alarm"],
}


def _classify_category(text: str) -> str:
    text_lower = text.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            return category
    return "Markets"


def _classify_severity(text: str) -> str:
    text_lower = text.lower()
    for severity, keywords in SEVERITY_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            return severity
    return "info"


def _guess_location(text: str) -> tuple:
    text_lower = text.lower()
    for loc, coords in LOCATION_COORDS.items():
        if loc in text_lower:
            return coords
    return (random.uniform(-35, 55), random.uniform(-120, 140))


def _extract_location_name(text: str) -> str:
    text_lower = text.lower()
    # Check longer names first to avoid partial matches
    sorted_locs = sorted(LOCATION_COORDS.keys(), key=len, reverse=True)
    for loc in sorted_locs:
        if loc in text_lower:
            return loc.title()
    return "Global"


def _blocking_news_search(query: str, max_results: int = 8) -> list:
    try:
        with DDGS() as ddgs:
            return list(ddgs.news(query, max_results=max_results, timelimit="d"))
    except Exception as e:
        print(f"DDG news search failed for '{query}': {e}")
        return []


def _blocking_text_search(query: str, max_results: int = 5) -> list:
    try:
        with DDGS() as ddgs:
            return list(ddgs.text(query, max_results=max_results, timelimit="w"))
    except Exception as e:
        print(f"DDG text search failed for '{query}': {e}")
        return []


def _format_time_ago(date_str: str) -> str:
    try:
        from datetime import datetime, timezone
        if isinstance(date_str, str) and date_str:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            diff = now - dt
            minutes = int(diff.total_seconds() / 60)
            if minutes < 0:
                return "just now"
            if minutes < 60:
                return f"{max(1, minutes)}m ago"
            hours = minutes // 60
            if hours < 24:
                return f"{hours}h ago"
            days = hours // 24
            return f"{days}d ago"
    except Exception:
        pass
    return "recently"


async def _generate_smart_queries_with_gemini(schema_info: str, sample_values: str) -> list:
    """
    Use Gemini to intelligently analyze the dataset and generate
    targeted news search queries that cover the full business environment.
    """
    try:
        from app.utils.gemini_client import gemini

        prompt = f"""You are generating news search queries for a financial dashboard globe.
Given a dataset schema and sample values, generate 6-8 diverse news search queries that:
1. Cover the INDUSTRY/DOMAIN the dataset belongs to
2. Cover KEY COMPANIES, SECTORS, and REGIONS relevant to this data
3. Include broader economic/macro trends affecting this domain
4. Include regulatory/policy news relevant to this domain
5. Each query should be short (3-6 words) and optimized for news search

Dataset schema: {schema_info}

Sample values from key columns: {sample_values}

Respond with ONLY a JSON object:
{{"queries": ["query 1", "query 2", ...], "domain": "detected domain name"}}"""

        result = await gemini.generate_json(prompt=prompt, temperature=0.3)
        queries = result.get("queries", [])
        domain = result.get("domain", "finance")
        if queries and isinstance(queries, list):
            return [q for q in queries if isinstance(q, str)][:8], domain
    except Exception as e:
        print(f"Gemini query generation failed: {e}")

    return [], "finance"


def _build_default_financial_queries() -> list:
    """Broad coverage of all financial news genres when no dataset is loaded."""
    return DEFAULT_QUERIES[:8]


def _build_dataset_queries_fallback(categories: list, regions: list, columns: list) -> list:
    """Fallback query builder if Gemini is unavailable."""
    queries = ["global financial markets news today"]

    # Detect domain from column names
    col_text = " ".join(columns).lower()

    # Finance / Banking domain
    if any(w in col_text for w in ["transaction", "balance", "amount", "loan", "bank", "deposit"]):
        queries.extend([
            "banking sector news today",
            "digital payments fintech trends",
            "interest rates monetary policy",
        ])
    # Healthcare domain
    elif any(w in col_text for w in ["patient", "diagnosis", "medicine", "hospital", "drug"]):
        queries.extend([
            "healthcare industry news today",
            "pharmaceutical biotech developments",
            "hospital medical technology trends",
        ])
    # Retail / E-commerce domain
    elif any(w in col_text for w in ["product", "price", "order", "customer", "cart", "sku"]):
        queries.extend([
            "retail industry consumer spending",
            "ecommerce trends online shopping",
            "supply chain logistics news",
        ])
    # Real Estate domain
    elif any(w in col_text for w in ["property", "rent", "sqft", "bedroom", "listing", "mortgage"]):
        queries.extend([
            "real estate housing market news",
            "mortgage rates property trends",
            "commercial real estate development",
        ])
    # Tech / SaaS domain
    elif any(w in col_text for w in ["user", "subscription", "churn", "api", "software", "app"]):
        queries.extend([
            "technology industry news today",
            "SaaS cloud computing trends",
            "AI artificial intelligence developments",
        ])
    # General fallback
    else:
        queries.extend([
            "business economy news today",
            "industry trends global markets",
        ])

    # Add category-based queries
    for cat in categories[:3]:
        cat_lower = cat.lower().strip()
        if cat_lower and len(cat_lower) > 2:
            queries.append(f"{cat_lower} industry news trends")

    # Add region-based queries
    for region in regions[:2]:
        region_lower = region.lower().strip()
        if region_lower and len(region_lower) > 1:
            queries.append(f"{region_lower} business economy news")

    return queries


@router.get("/news")
async def get_news(
    session_id: Optional[str] = Query(None),
    topics: Optional[str] = Query(None),
    regions: Optional[str] = Query(None),
    max_results: int = Query(25),
):
    """
    Fetch real-time news. Adapts to ANY dataset type using Gemini + DuckDuckGo.
    - No dataset: broad financial news covering all genres
    - Financial dataset: banking, markets, commodities, FX, crypto, etc.
    - Non-financial dataset: news about that industry + related companies + macro trends
    """
    global _news_cache

    cache_key = f"{session_id}:{topics}:{regions}"
    if _news_cache["data"] and _news_cache["key"] == cache_key and (time.time() - _news_cache["ts"]) < NEWS_TTL:
        return _news_cache["data"]

    # ── Extract dataset context ──────────────────────────────────────────────
    category_list = []
    region_list = []
    column_list = []
    schema_info = ""
    sample_values = ""
    domain = "finance"

    if session_id:
        try:
            from app.main import app
            sessions = app.state.sessions
            session = sessions.get(session_id, {})
            tables = session.get("tables", {})

            for table_name, meta in tables.items():
                df = meta.get("df")
                if df is None:
                    continue

                column_list.extend(list(df.columns))
                schema_info += f"Table '{table_name}': columns = {list(df.columns)}\n"

                for col in df.columns:
                    col_lower = col.lower()
                    # Broad detection of category-like columns
                    if any(kw in col_lower for kw in [
                        "category", "type", "sector", "industry", "class",
                        "segment", "department", "group", "status", "channel",
                        "brand", "vendor", "supplier", "product"
                    ]):
                        vals = df[col].dropna().unique()[:10]
                        category_list.extend([str(v) for v in vals])
                        sample_values += f"{col}: {[str(v) for v in vals[:5]]}\n"

                    # Broad detection of region/location columns
                    if any(kw in col_lower for kw in [
                        "region", "country", "state", "city", "location",
                        "branch", "area", "zone", "market", "territory"
                    ]):
                        vals = df[col].dropna().unique()[:8]
                        region_list.extend([str(v) for v in vals])
                        sample_values += f"{col}: {[str(v) for v in vals[:5]]}\n"

                    # Sample numeric column names for context
                    if col_lower not in ("id",) and df[col].dtype in ("float64", "int64"):
                        sample_values += f"{col}: numeric (min={df[col].min():.0f}, max={df[col].max():.0f})\n"

        except Exception as e:
            print(f"Could not extract dataset context: {e}")

    if topics:
        category_list = topics.split(",")
    if regions:
        region_list = regions.split(",")

    # ── Generate search queries ──────────────────────────────────────────────
    queries = []

    if schema_info:
        # Try Gemini-powered smart query generation
        gemini_queries, domain = await _generate_smart_queries_with_gemini(schema_info, sample_values)
        if gemini_queries:
            queries = gemini_queries
            print(f"Gemini generated {len(queries)} queries for domain '{domain}': {queries}")

    # Fallback or supplement
    if not queries and (category_list or region_list or column_list):
        queries = _build_dataset_queries_fallback(category_list, region_list, column_list)
        print(f"Using fallback dataset queries: {queries}")
    elif not queries:
        queries = _build_default_financial_queries()
        print(f"Using default broad financial queries")

    # Always ensure we have broad market coverage too
    broad_queries = [
        "stock market indices today",
        "commodity prices oil gold silver",
    ]
    for bq in broad_queries:
        if bq not in queries:
            queries.append(bq)

    # ── Fetch news from DuckDuckGo ───────────────────────────────────────────
    loop = asyncio.get_running_loop()
    all_news = []
    seen_headlines = set()

    for query in queries[:8]:  # cap at 8 queries to avoid rate limits
        try:
            results = await loop.run_in_executor(None, _blocking_news_search, query, 6)
            if not results:
                results = await loop.run_in_executor(None, _blocking_text_search, query, 4)

            for item in results:
                headline = item.get("title", item.get("headline", ""))
                if not headline or headline in seen_headlines:
                    continue
                seen_headlines.add(headline)

                description = item.get("body", item.get("snippet", item.get("description", "")))
                full_text = f"{headline} {description}"
                lat, lng = _guess_location(full_text)

                all_news.append({
                    "id": len(all_news) + 1,
                    "headline": headline,
                    "description": description,
                    "location": _extract_location_name(full_text),
                    "lat": lat,
                    "lng": lng,
                    "category": _classify_category(full_text),
                    "severity": _classify_severity(headline),
                    "time": _format_time_ago(item.get("date", "")),
                    "url": item.get("url", item.get("href", "")),
                    "source": item.get("source", ""),
                })
        except Exception as e:
            print(f"News search failed for '{query}': {e}")

    news_items = all_news[:max_results]

    response = {
        "news": news_items,
        "count": len(news_items),
        "queries_used": queries,
        "domain": domain,
        "dataset_categories": category_list[:10],
        "dataset_regions": region_list[:5],
    }

    _news_cache = {"data": response, "ts": time.time(), "key": cache_key}
    return response


@router.get("/market-data")
async def get_market_data():
    """Fetch live market/commodity prices using yfinance."""
    global _market_cache

    if _market_cache["data"] and (time.time() - _market_cache["ts"]) < MARKET_TTL:
        return _market_cache["data"]

    symbols = [
        ("WTI Crude", "CL=F"),
        ("Brent Crude", "BZ=F"),
        ("Natural Gas", "NG=F"),
        ("Gold", "GC=F"),
        ("Silver", "SI=F"),
        ("Wheat", "ZW=F"),
        ("Corn", "ZC=F"),
        ("Bitcoin", "BTC-USD"),
        ("S&P 500", "^GSPC"),
        ("Nasdaq", "^IXIC"),
        ("DXY", "DX-Y.NYB"),
        ("EUR/USD", "EURUSD=X"),
    ]

    try:
        import yfinance as yf
        loop = asyncio.get_running_loop()

        def _fetch_all():
            results = []
            for label, symbol in symbols:
                try:
                    ticker = yf.Ticker(symbol)
                    hist = ticker.history(period="2d")
                    if hist.empty or len(hist) < 1:
                        continue
                    price = float(hist["Close"].iloc[-1])
                    prev = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else price
                    change_pct = ((price - prev) / prev * 100) if prev else 0

                    if price >= 1000:
                        value = f"${price:,.0f}"
                    elif price >= 10:
                        value = f"${price:,.2f}"
                    else:
                        value = f"${price:.4f}"

                    results.append({
                        "label": label,
                        "value": value,
                        "change": f"{'+' if change_pct >= 0 else ''}{change_pct:.1f}%",
                        "up": change_pct >= 0,
                    })
                except Exception as e:
                    print(f"yfinance failed for {symbol}: {e}")
            return results

        commodities = await loop.run_in_executor(None, _fetch_all)

        if commodities:
            response = {"commodities": commodities, "source": "yfinance", "live": True}
            _market_cache = {"data": response, "ts": time.time()}
            return response

    except ImportError:
        print("yfinance not installed, using fallback")

    return {"commodities": [], "source": "unavailable", "live": False}
