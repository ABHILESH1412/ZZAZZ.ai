import { endpoint, getSuggestions, parseDraft, requestLimit } from '../server/gemini';

interface Env {
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
  FOLIO_ORIGIN: string;
}

async function readDraft(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return { status: 400, error: 'A draft is required.' } as const;
  const decoder = new TextDecoder();
  let raw = '';
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > requestLimit) {
        await reader.cancel().catch(() => {});
        return { status: 413, error: 'This draft is too large to send.' } as const;
      }
      raw += decoder.decode(value, { stream: true });
    }
    const draft = parseDraft(raw + decoder.decode());
    return draft ? { draft } : { status: 400, error: 'Send a draft of up to 12,000 characters.' } as const;
  } catch {
    return { status: 400, error: 'The draft could not be read.' } as const;
  } finally {
    reader.releaseLock();
  }
}

export default {
  async fetch(request: Request, env: Env) {
    const origin = request.headers.get('Origin');
    if (!env.FOLIO_ORIGIN || origin !== env.FOLIO_ORIGIN) return new Response(null, { status: 403 });
    const headers = new Headers({
      'Access-Control-Allow-Origin': env.FOLIO_ORIGIN,
      'Cache-Control': 'no-store',
      'Vary': 'Origin',
    });
    const send = (status: number, data: { error: string } | { suggestions: string[] }) => Response.json(data, { status, headers });
    if (new URL(request.url).pathname !== endpoint) return send(404, { error: 'Unknown endpoint.' });
    if (request.method === 'OPTIONS') {
      headers.set('Access-Control-Allow-Methods', 'POST');
      headers.set('Access-Control-Allow-Headers', 'Content-Type');
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== 'POST') return send(405, { error: 'Use POST to request editorial suggestions.' });
    if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return send(415, { error: 'Send the draft as JSON.' });
    if (!env.GEMINI_API_KEY) return send(503, { error: 'Live suggestions are temporarily unavailable.' });
    const result = await readDraft(request);
    if (!result.draft) return send(result.status, { error: result.error });

    const suggestions = await getSuggestions(result.draft, { apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL }, async (url, options) => {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          const provider = await response.clone().json<{ error?: { message?: string } }>().catch(() => undefined);
          const message = provider?.error?.message ?? '';
          const category = /location|region|country/i.test(message) ? 'region'
            : /API key|permission|credentials/i.test(message) ? 'credentials' : 'upstream';
          headers.set('X-Folio-Upstream-Status', response.status + '-' + category);
        }
        return response;
      } catch (error) {
        headers.set('X-Folio-Upstream-Status', error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network');
        throw error;
      }
    });
    if (suggestions.status === 429) return send(429, { error: 'Gemini’s free-tier quota is currently exhausted. Try again later.' });
    if (suggestions.status !== 200) return send(502, { error: 'Gemini could not generate suggestions. Try again shortly.' });
    return send(200, suggestions.data);
  },
} satisfies ExportedHandler<Env>;
