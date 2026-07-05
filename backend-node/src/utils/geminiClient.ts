/**
 * Gemini API client
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

let _lastCallTime = 0;
const MIN_CALL_INTERVAL = 500; // ms

async function rateLimitedDelay(): Promise<void> {
  const now = Date.now();
  const elapsed = now - _lastCallTime;
  if (elapsed < MIN_CALL_INTERVAL) {
    await sleep(MIN_CALL_INTERVAL - elapsed);
  }
  _lastCallTime = Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

class GeminiClient {
  private modelName: string;

  constructor(modelName: string = config.geminiModel) {
    this.modelName = modelName;
  }

  async generate(opts: {
    prompt: string;
    system_instruction?: string;
    temperature?: number;
    max_retries?: number;
    json_mode?: boolean;
  }): Promise<string> {
    const { prompt, system_instruction = '', temperature = 0.2, max_retries = 3, json_mode = false } = opts;

    for (let attempt = 0; attempt <= max_retries; attempt++) {
      await rateLimitedDelay();
      try {
        const model = genAI.getGenerativeModel({
          model: this.modelName,
          systemInstruction: system_instruction || undefined,
          generationConfig: {
            temperature,
            maxOutputTokens: 8192,
            ...(json_mode ? { responseMimeType: 'application/json' } : {}),
          },
        });

        const result = await model.generateContent(prompt);
        return result.response.text().trim();
      } catch (e: any) {
        const errStr = String(e).toLowerCase();
        if (errStr.includes('429') || errStr.includes('resource_exhausted')) {
          const wait = (attempt + 1) * 8000;
          console.warn(`[WARN] Rate limited. Waiting ${wait / 1000}s (attempt ${attempt + 1})...`);
          await sleep(wait);
          continue;
        }
        if (attempt < max_retries) {
          await sleep(2 ** attempt * 1000);
          continue;
        }
        throw new Error(`Gemini API failed after ${max_retries + 1} attempts: ${e.message}`);
      }
    }
    return '';
  }

  async generateJson(opts: {
    prompt: string;
    system_instruction?: string;
    temperature?: number;
  }): Promise<Record<string, any>> {
    const response = await this.generate({ ...opts, json_mode: true });

    if (!response) throw new Error('Empty response from Gemini when JSON was expected.');

    try { return JSON.parse(response); } catch { /* fall through */ }

    const match = response.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }

    throw new Error(`Could not parse JSON from Gemini response: ${response.slice(0, 300)}`);
  }
}

export const gemini = new GeminiClient();
