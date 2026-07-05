/**
 * Search Agent — uses Gemini Google Search Grounding to reliably search the web.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import { WebResult } from '../types';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

export async function runSearchAgent(opts: {
  query: string;
  max_results?: number;
  time_filter?: string;
}): Promise<{ search_query: string; results: WebResult[]; count: number; error?: string }> {
  const { query, max_results = 5 } = opts;
  try {
    const model = genAI.getGenerativeModel({
      model: config.geminiModel,
      tools: [{ googleSearch: {} } as any],
    });

    const result = await model.generateContent(
      `Search the web for the following query and provide a factual, concise summary of the results: ${query}`
    );

    const text = result.response.text();
    const metadata = result.response.candidates?.[0]?.groundingMetadata;
    const chunks = (metadata as any)?.groundingChunks ?? [];
    const supports = (metadata as any)?.groundingSupports ?? [];

    const results: WebResult[] = [];

    for (let i = 0; i < chunks.length && results.length < max_results; i++) {
      const web = chunks[i]?.web;
      if (!web || !web.uri || !web.title) continue;

      // Find the first grounding support text that references this chunk
      const support = supports.find((s: any) => s.groundingChunkIndices?.includes(i));
      const snippet = support?.segment?.text || text.substring(0, 200) + '...';

      results.push({
        title: String(web.title),
        snippet: String(snippet),
        url: String(web.uri),
      });
    }

    return { search_query: query, results, count: results.length };
  } catch (e: any) {
    console.error(`[WARN] Web search failed:`, e);
    return { search_query: query, results: [], count: 0, error: String(e) };
  }
}

export function buildSearchQuery(question: string, context: string = ''): string {
  const bankingKeywords = ['bank', 'finance', 'market', 'economy', 'trading', 'investment', 'stock', 'price', 'share'];
  const hasContext = bankingKeywords.some((kw) => question.toLowerCase().includes(kw));
  if (!hasContext && context) return `${question} ${context} banking finance trends`;
  if (!hasContext) return `${question} banking industry trends`;
  return question;
}
