import { createSignal, For, onCleanup, Show } from 'solid-js';
import { Lightbulb, Sparkles } from 'lucide-solid';
import type { Draft } from './model';

type Feedback = { draft: Draft; suggestions: string[] };
const limit = 12_000;
const hostedEndpoint = import.meta.env.VITE_FOLIO_SUGGESTIONS_URL?.trim();
const demoCodeKey = 'folio-reviewer-code';

export default function Suggestions(props: { draft: Draft }) {
  const [feedback, setFeedback] = createSignal<Feedback>();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [demoCode, setDemoCode] = createSignal('');
  if (hostedEndpoint) {
    try { setDemoCode(sessionStorage.getItem(demoCodeKey) ?? ''); } catch { /* In-memory entry still works. */ }
  }
  let controller: AbortController | undefined;
  onCleanup(() => controller?.abort());
  const stale = () => {
    const previous = feedback()?.draft;
    return previous && (previous.title !== props.draft.title || previous.topic !== props.draft.topic || previous.body !== props.draft.body);
  };

  async function requestSuggestions() {
    if (loading() || !props.draft.body.trim()) return;
    const code = demoCode().trim();
    if (hostedEndpoint && !code) { setError('Enter your reviewer access code.'); return; }
    const draft = props.draft;
    const request = new AbortController();
    controller = request;
    setLoading(true);
    setError('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (hostedEndpoint) headers['X-Folio-Demo-Code'] = code;
      const response = await fetch(hostedEndpoint || '/api/editorial-suggestions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: draft.title, topic: draft.topic, body: draft.body.slice(0, limit) }),
        signal: request.signal,
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'AI suggestions are temporarily unavailable.');
        return;
      }
      if (!Array.isArray(result.suggestions) || result.suggestions.some((item: unknown) => typeof item !== 'string')) {
        setError('AI suggestions are temporarily unavailable.');
        return;
      }
      if (hostedEndpoint) {
        try { sessionStorage.setItem(demoCodeKey, code); } catch { /* Reuse the in-memory entry. */ }
      }
      setFeedback({ draft, suggestions: result.suggestions });
    } catch {
      if (!request.signal.aborted) setError(hostedEndpoint
        ? 'The live suggestions service could not be reached. Try again shortly.'
        : 'AI suggestions are unavailable. Start Folio with its API server to use them.');
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }

  return <section class="editorial-ai" aria-labelledby="editorial-heading">
    <div class="editorial-ai-title"><Lightbulb size={18} /><h3 id="editorial-heading">How to raise the value</h3></div>
    <Show when={hostedEndpoint || import.meta.env.VITE_STATIC_DEMO !== '1'} fallback={<p class="ai-sharing">Live AI suggestions are available when you run Folio locally with a Gemini key.</p>}>
      <p class="ai-sharing">Requesting suggestions sends your title, topic, and {props.draft.body.length > limit ? 'the first 12,000 characters of your draft' : 'draft text'} to Google Gemini.</p>
      <Show when={hostedEndpoint}>
        <label class="reviewer-code">Reviewer access code
          <input type="password" value={demoCode()} onInput={event => setDemoCode(event.currentTarget.value)}
            autocomplete="off" maxLength={128} spellcheck={false} />
        </label>
      </Show>
      <button class="button small" type="button" disabled={loading() || !props.draft.body.trim()} onClick={requestSuggestions}><Sparkles size={15} />{loading() ? 'Reading your draft…' : feedback() ? 'Refresh AI suggestions' : 'Get AI suggestions'}</button>
    </Show>
    <Show when={error()}><p class="ai-error" role="alert">{error()}</p></Show>
    <Show when={stale()}><p class="ai-sharing" role="status">Draft changed. Refresh for feedback on this version.</p></Show>
    <Show when={feedback() && !stale()}>
      <ul class="ai-results" aria-live="polite"><For each={feedback()?.suggestions}>{suggestion => <li>{suggestion}</li>}</For></ul>
    </Show>
  </section>;
}
