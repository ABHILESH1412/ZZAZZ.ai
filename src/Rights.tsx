import { createMemo, createSignal, For, Show, untrack } from 'solid-js';
import { Bot, Braces, Check, Code2, Copy, Eye, FileCheck2, FileText, Globe2, LockKeyhole, Scale, ShieldCheck, UserRound, Workflow } from 'lucide-solid';
import { fingerprint, localDate, money, previewText, termsData, termsSummary, uses, type Permission, type Publication, type Terms, type Use } from './model';

const symbols = { reading: UserRound, quotation: Bot, training: Workflow, reuse: FileText };
const options: { value: Permission; label: string }[] = [
  { value: 'allowed', label: 'Allow' }, { value: 'approval', label: 'Ask first' }, { value: 'prohibited', label: 'Prohibit' },
];

function CopyButton(props: { value: string; label?: string }) {
  const [status, setStatus] = createSignal('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(props.value);
      setStatus('Copied');
    } catch { setStatus('Select the text to copy'); }
  }
  return <button class="copy-button" type="button" onClick={copy}><Show when={status() === 'Copied'} fallback={<Copy size={15} />}><Check size={15} /></Show><span aria-live="polite">{status() || props.label || 'Copy'}</span></button>;
}

export function Licence(props: { terms: Terms; onChange: (value: Terms) => void; publish: () => void; ready: boolean; dirty: boolean }) {
  const json = createMemo(() => JSON.stringify(termsData(props.terms), null, 2));
  const update = (id: Use, choice: Partial<Terms[Use]>) => props.onChange({ ...props.terms, [id]: { ...props.terms[id], ...choice } });
  return (
    <>
      <div class="page-heading">
        <div><div class="eyebrow"><Scale size={15} /> RIGHTS & PRICING</div><h1>Licence builder<span>.</span></h1><p>Decide how people and AI systems may use your work.</p></div>
        <button class="button primary" type="button" onClick={props.publish} disabled={!props.ready || !props.dirty}><Globe2 size={17} /> Publish version</button>
      </div>
      <Show when={!props.ready || !props.dirty}>
        <p class="notice"><FileCheck2 size={17} />{!props.ready ? 'Add a title and story text before publishing.' : 'These terms match the published version. Any edit can be published as a new version.'}</p>
      </Show>
      <section class="card licence-card" aria-labelledby="permissions-heading">
        <div class="card-head"><div class="card-title"><Scale size={18} /><h2 id="permissions-heading">Usage permissions</h2></div><span class="pill neutral">USD per use</span></div>
        <div class="licence-options">
          <For each={uses}>{use => {
            const Icon = symbols[use.id];
            return <div class="permission-row">
              <div class="permission-description"><span class="soft-icon"><Icon size={19} /></span><div><h3>{use.label}</h3><p>{use.detail}</p></div></div>
              <fieldset class="segmented"><legend class="sr-only">{use.label} permission</legend>
                <For each={options}>{option => <label classList={{ selected: props.terms[use.id].permission === option.value }}>
                  <input type="radio" name={use.id} value={option.value} checked={props.terms[use.id].permission === option.value} onChange={() => update(use.id, { permission: option.value })} />{option.label}
                </label>}</For>
              </fieldset>
              <label class="price-input" classList={{ disabled: props.terms[use.id].permission === 'prohibited' }}>
                <span aria-hidden="true">$</span><span class="sr-only">{use.label} price in USD</span>
                <input type="number" min="0" max="100000" step=".01" inputMode="decimal" disabled={props.terms[use.id].permission === 'prohibited'} value={untrack(() => props.terms[use.id].cents / 100)}
                  onInput={event => {
                    const value = event.currentTarget.valueAsNumber;
                    const cents = Number.isFinite(value) ? Math.round(Math.min(100000, Math.max(0, value)) * 100) : 0;
                    update(use.id, { cents });
                  }}
                  onBlur={event => { event.currentTarget.value = String(props.terms[use.id].cents / 100); }} />
              </label>
            </div>;
          }}</For>
        </div>
      </section>
      <div class="detail-grid">
        <section class="card"><div class="card-head"><div class="card-title"><FileText size={18} /><h2>Plain-English terms</h2></div></div>
          <div class="card-padding"><p class="terms-paragraph">{termsSummary(props.terms)}</p><p class="muted">Ask first requires approval before any use. A price of $0 allows free use if permission is granted.</p></div>
        </section>
        <section class="card"><div class="card-head"><div class="card-title"><Braces size={18} /><h2>Machine-readable terms</h2></div><CopyButton value={json()} /></div>
          <div class="card-padding"><pre class="code-panel"><code>{json()}</code></pre></div>
        </section>
      </div>
    </>
  );
}

export function PublicWork(props: { publication: Publication; dirty: boolean }) {
  const [view, setView] = createSignal<'reader' | 'machine'>('reader');
  const verified = createMemo(() => fingerprint(props.publication) === props.publication.fingerprint);
  const json = createMemo(() => {
    const publication = props.publication;
    return JSON.stringify({
      schema: 'folio.work.v1', work_id: 'folio-city', version: publication.version,
      title: publication.draft.title, byline: publication.author, published_at: publication.publishedAt, authorship: publication.draft.disclosure,
      preview: previewText(publication.draft.body), licence: termsData(publication.terms),
      integrity: { algorithm: 'SHA-256', fingerprint: publication.fingerprint, matches_local_snapshot: verified() },
      usage_record_example: publication.terms.quotation.permission === 'allowed' ? {
        record_id: 'example-quote-v' + publication.version, work_id: 'folio-city', version: publication.version,
        requester: 'Harbor Guide AI', use: 'quotation', amount_cents: publication.terms.quotation.cents,
        currency: 'USD',
      } : null,
    }, null, 2);
  });
  return (
    <>
      <div class="page-heading">
        <div><div class="eyebrow"><Globe2 size={15} /> PUBLISHED WORK</div><h1>Public work page<span>.</span></h1><p>Preview what readers and AI systems receive when they open this piece.</p></div>
        <div class="segmented view-switch" role="group" aria-label="Public page view">
          <button classList={{ selected: view() === 'reader' }} aria-pressed={view() === 'reader'} onClick={() => setView('reader')}><Eye size={16} /> Reader</button>
          <button classList={{ selected: view() === 'machine' }} aria-pressed={view() === 'machine'} onClick={() => setView('machine')}><Code2 size={16} /> AI system</button>
        </div>
      </div>
      <Show when={props.dirty}><p class="notice"><LockKeyhole size={16} /> This page shows version {props.publication.version}. <a href="#licence">Review unpublished changes</a></p></Show>
      <Show when={view() === 'reader'} fallback={<section class="card"><div class="card-head"><div class="card-title"><Braces size={18} /><h2>AI system response</h2></div><CopyButton value={json()} /></div><div class="card-padding"><pre class="code-panel public-code"><code>{json()}</code></pre></div></section>}>
        <div class="public-layout">
          <article class="card article-card">
            <Show when={props.publication.draft.title.trim().toLowerCase() === 'the city after midnight'}>
              <figure class="article-cover"><img class="article-image" src="/night-tram.webp" alt="Illustrative image of a tram on a rain-soaked street at night" /><figcaption>AI-generated illustration</figcaption></figure>
            </Show>
            <div class="article-content">
              <div class="eyebrow">{props.publication.draft.topic}</div>
              <h2>{props.publication.draft.title}</h2>
              <div class="byline"><span class="avatar">MV</span><div><strong>{props.publication.author}</strong><span>{localDate(props.publication.publishedAt)} · Version {props.publication.version}</span></div><span class="pill neutral">{props.publication.draft.disclosure}</span></div>
              <div class="story-preview"><For each={previewText(props.publication.draft.body).split('\n\n')}>{part => <p>{part}</p>}</For></div>
              <div class="article-end"><LockKeyhole size={16} /> End of public preview</div>
            </div>
          </article>
          <aside class="public-aside">
            <section class="card">
              <div class="card-head"><div class="card-title"><Scale size={18} /><h2>Usage terms</h2></div></div>
              <div class="card-padding published-terms">
                <For each={uses}>{use => {
                  const rule = () => props.publication.terms[use.id];
                  return <div><strong>{use.label}</strong><span>{rule().permission === 'prohibited' ? 'Prohibited' : (rule().permission === 'approval' ? 'Ask first · ' : '') + (rule().cents ? money(rule().cents) : 'Free')}</span></div>;
                }}</For>
              </div>
            </section>
            <section class="card">
              <div class="card-head"><div class="card-title"><ShieldCheck size={18} /><h2>Publication record</h2></div></div>
              <div class="card-padding">
                <span class={'pill ' + (verified() ? 'green' : 'warning')}>{verified() ? 'Matches published version' : 'Integrity mismatch'}</span>
                <p class="muted">{verified() ? 'The story and terms match the snapshot saved when this version was published.' : 'The story or terms differ from the saved fingerprint.'}</p>
                <details class="integrity-details"><summary>View content fingerprint</summary><p>This local check covers the byline, story text, and licence terms.</p><code>{props.publication.fingerprint}</code><CopyButton value={props.publication.fingerprint} label="Copy fingerprint" /></details>
              </div>
            </section>
          </aside>
        </div>
      </Show>
    </>
  );
}
