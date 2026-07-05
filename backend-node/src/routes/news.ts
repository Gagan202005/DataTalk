/**
 * GET /api/news — Real-time financial news
 */
import { Router, Request, Response } from 'express';
import { sessions } from '../sessions';
import { gemini } from '../utils/geminiClient';
import { runSearchAgent } from '../agents/searchAgent';

const NEWS_TTL = 300_000; // 5 minutes
let _newsCache: { data: any; ts: number; key: string } = { data: null, ts: 0, key: '' };

const DEFAULT_QUERIES = [
  'global financial markets news today', 'stock market S&P 500 Nasdaq today',
  'oil gold commodity prices news', 'central bank interest rate decision',
  'cryptocurrency bitcoin ethereum news', 'forex dollar euro currency news',
  'banking fintech digital payments news', 'international trade tariffs economy',
];

const LOCATION_COORDS: Record<string, [number, number]> = {
  india: [20.59, 78.96], usa: [39.82, -98.57], uk: [55.37, -3.43],
  china: [35.86, 104.19], japan: [36.20, 138.25], germany: [51.16, 10.45],
  france: [46.60, 1.88], australia: [-25.27, 133.77], singapore: [1.35, 103.81],
  london: [51.50, -0.12], 'new york': [40.71, -74.00], mumbai: [19.07, 72.87],
  dubai: [25.20, 55.27], global: [20.0, 0.0], world: [20.0, 0.0],
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Commodities: ['oil','crude','gold','silver','wheat','gas','metal','commodity','copper'],
  'Central Bank': ['fed','rbi','ecb','central bank','monetary policy','inflation','interest rate'],
  Crypto: ['bitcoin','crypto','ethereum','blockchain','btc','defi'],
  FX: ['forex','dollar','euro','yen','rupee','currency','exchange rate'],
  Banking: ['bank','loan','credit','npa','fintech','upi','mortgage','natwest','rbi'],
  Tech: ['tech','ai','nvidia','apple','google','microsoft','semiconductor'],
  Markets: [],
};

const SEVERITY_KEYWORDS: Record<string, string[]> = {
  critical: ['crash','plunge','surge','record','crisis','collapse','emergency','historic'],
  warning: ['fall','rise','drop','cut','hike','volatile','warn','risk','decline','tumble'],
};

function classifyCategory(text: string): string {
  const t = text.toLowerCase();
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.some((k) => t.includes(k))) return cat;
  }
  return 'Markets';
}

function classifySeverity(text: string): string {
  const t = text.toLowerCase();
  for (const [sev, kws] of Object.entries(SEVERITY_KEYWORDS)) {
    if (kws.some((k) => t.includes(k))) return sev;
  }
  return 'info';
}

function guessLocation(text: string): [number, number] {
  const t = text.toLowerCase();
  const sorted = Object.keys(LOCATION_COORDS).sort((a, b) => b.length - a.length);
  for (const loc of sorted) {
    if (t.includes(loc)) return LOCATION_COORDS[loc];
  }
  return [Math.random() * 90 - 35, Math.random() * 260 - 120];
}

function extractLocationName(text: string): string {
  const t = text.toLowerCase();
  const sorted = Object.keys(LOCATION_COORDS).sort((a, b) => b.length - a.length);
  for (const loc of sorted) {
    if (t.includes(loc)) return loc.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return 'Global';
}

function formatTimeAgo(dateStr: string): string {
  try {
    const dt = new Date(dateStr);
    if (isNaN(dt.getTime())) return 'recently';
    const minutes = Math.round((Date.now() - dt.getTime()) / 60_000);
    if (minutes < 0) return 'just now';
    if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  } catch {
    return 'recently';
  }
}

async function generateSmartQueries(schemaInfo: string, sampleValues: string): Promise<[string[], string]> {
  try {
    const prompt = `You are generating news search queries for a financial dashboard globe.
Given a dataset schema and sample values, generate 6-8 diverse news search queries that:
1. Cover the INDUSTRY/DOMAIN the dataset belongs to
2. Cover KEY COMPANIES, SECTORS, and REGIONS relevant to this data
3. Include broader economic/macro trends affecting this domain
4. Include regulatory/policy news relevant to this domain
5. Each query should be short (3-6 words) and optimized for news search

Dataset schema: ${schemaInfo}
Sample values from key columns: ${sampleValues}

Respond with ONLY a JSON object:
{"queries": ["query 1", "query 2", ...], "domain": "detected domain name"}`;
    const result = await gemini.generateJson({ prompt, temperature: 0.3 });
    const queries = (result.queries as string[]).filter((q) => typeof q === 'string').slice(0, 8);
    return [queries, result.domain ?? 'finance'];
  } catch {
    return [[], 'finance'];
  }
}

const router = Router();

router.get('/news', async (req: Request, res: Response): Promise<void> => {
  try {
    const session_id = req.query.session_id as string | undefined;
    const topics = req.query.topics as string | undefined;
    const regions = req.query.regions as string | undefined;
    const maxResults = parseInt(req.query.max_results as string ?? '25', 10);

    const cacheKey = `${session_id ?? ''}:${topics ?? ''}:${regions ?? ''}`;
    if (_newsCache.data && _newsCache.key === cacheKey && Date.now() - _newsCache.ts < NEWS_TTL) {
      res.json(_newsCache.data);
      return;
    }

    let categoryList: string[] = [];
    let regionList: string[] = [];
    let columnList: string[] = [];
    let schemaInfo = '';
    let sampleValues = '';
    let domain = 'finance';

    if (session_id && sessions.has(session_id)) {
      const session = sessions.get(session_id)!;
      for (const [tname, meta] of Object.entries(session.tables ?? {})) {
        columnList.push(...Object.keys(meta.rows[0] ?? {}));
        schemaInfo += `Table '${tname}': columns = ${Object.keys(meta.rows[0] ?? {}).join(', ')}\n`;
        for (const col of Object.keys(meta.rows[0] ?? {})) {
          const colLower = col.toLowerCase();
          if (['category','type','sector','industry','class','segment','status'].some((kw) => colLower.includes(kw))) {
            const vals = [...new Set(meta.rows.map((r) => String(r[col] ?? '')).filter(Boolean))].slice(0, 10);
            categoryList.push(...vals);
            sampleValues += `${col}: ${vals.slice(0, 5)}\n`;
          }
          if (['region','country','state','city','location','branch','area'].some((kw) => colLower.includes(kw))) {
            const vals = [...new Set(meta.rows.map((r) => String(r[col] ?? '')).filter(Boolean))].slice(0, 8);
            regionList.push(...vals);
            sampleValues += `${col}: ${vals.slice(0, 5)}\n`;
          }
        }
      }
    }

    if (topics) categoryList = topics.split(',');
    if (regions) regionList = regions.split(',');

    let queries: string[] = [];
    if (schemaInfo) {
      const [gq, gd] = await generateSmartQueries(schemaInfo, sampleValues);
      if (gq.length) { queries = gq; domain = gd; }
    }
    if (!queries.length && (categoryList.length || regionList.length || columnList.length)) {
      queries = ['global financial markets news today', 'banking sector news today', 'digital payments fintech trends'];
      for (const cat of categoryList.slice(0, 3)) if (cat.length > 2) queries.push(`${cat.toLowerCase()} industry news`);
      for (const reg of regionList.slice(0, 2)) if (reg.length > 1) queries.push(`${reg.toLowerCase()} business economy news`);
    }
    if (!queries.length) queries = DEFAULT_QUERIES.slice(0, 8);

    queries = [...new Set([...queries, 'stock market indices today', 'commodity prices oil gold silver'])];

    const allNews: any[] = [];
    const seenHeadlines = new Set<string>();

    for (const query of queries.slice(0, 8)) {
      try {
        const results = await runSearchAgent({ query, max_results: 6 });
        for (const item of results.results) {
          const headline = item.title ?? '';
          if (!headline || seenHeadlines.has(headline)) continue;
          seenHeadlines.add(headline);
          const description = item.snippet ?? '';
          const fullText = `${headline} ${description}`;
          const [lat, lng] = guessLocation(fullText);
          allNews.push({
            id: allNews.length + 1,
            headline, description,
            location: extractLocationName(fullText),
            lat, lng,
            category: classifyCategory(fullText),
            severity: classifySeverity(headline),
            time: formatTimeAgo((item as any).date ?? ''),
            url: item.url ?? '',
            source: (item as any).source ?? '',
          });
        }
      } catch { /* ignore per-query errors */ }
    }

    const response = {
      news: allNews.slice(0, maxResults),
      count: Math.min(allNews.length, maxResults),
      queries_used: queries, domain,
      dataset_categories: categoryList.slice(0, 10),
      dataset_regions: regionList.slice(0, 5),
    };

    _newsCache = { data: response, ts: Date.now(), key: cacheKey };
    res.json(response);
  } catch (e: any) {
    res.status(500).json({ detail: `News fetch failed: ${e.message}` });
  }
});

export default router;
