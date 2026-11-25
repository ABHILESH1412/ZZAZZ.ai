import type { IncomingMessage, ServerResponse } from 'node:http';
import { endpoint, getSuggestions, parseDraft, requestLimit } from './gemini';

type Settings = { apiKey?: string; model?: string };

export function editorialApi(settings: Settings, request = fetch) {
  const apiKey = settings.apiKey?.trim();
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url?.split('?')[0] !== endpoint) return next();
    const send = (status: number, data: { error: string } | { suggestions: string[] }) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return send(405, { error: 'Use POST to request editorial suggestions.' });
    }
    if (req.headers.origin && !['http://', 'https://'].some(scheme => scheme + req.headers.host === req.headers.origin)) {
      return send(403, { error: 'Open Folio directly to request suggestions.' });
    }
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') {
      return send(415, { error: 'Send the draft as JSON.' });
    }
    if (!apiKey) return send(503, { error: 'Gemini suggestions are unavailable. Set GEMINI_API_KEY in .env.local and restart Folio.' });

    let raw = '';
    let bytes = 0;
    req.setEncoding('utf8');
    try {
      for await (const chunk of req.iterator({ destroyOnReturn: false })) {
        bytes += Buffer.byteLength(chunk);
        if (bytes > requestLimit) {
          req.resume();
          return send(413, { error: 'This draft is too large to send.' });
        }
        raw += chunk;
      }
    } catch {
      return send(400, { error: 'The draft could not be read.' });
    }

    const draft = parseDraft(raw);
    if (!draft) return send(400, { error: 'Send a draft of up to 12,000 characters.' });
    const result = await getSuggestions(draft, { apiKey, model: settings.model }, request);
    return send(result.status, result.data);
  };
}
