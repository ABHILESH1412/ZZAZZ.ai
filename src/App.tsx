import { createEffect, createMemo, createSignal, For, onCleanup, Show, Switch, Match } from 'solid-js';
import { Activity, Archive, BookOpen, Check, ChevronRight, CircleHelp, FilePenLine, FileText, Feather, GitFork, Globe2, Scale, Sparkles } from 'lucide-solid';
import gsap from 'gsap';
import { assess, author, defaultTerms, initialDraft, money, publish, sameWork, seedPublication, topics, wordCount, type Draft, type Publication, type Terms } from './model';
import { Licence, PublicWork } from './Rights';
import Dashboard from './Dashboard';
import BackCatalogue from './BackCatalogue';
import DerivativeMap from './DerivativeMap';
import Suggestions from './Suggestions';

const pages = [
  { id: 'editor', label: 'Write & value', icon: FilePenLine },
  { id: 'licence', label: 'Licence builder', icon: Scale },
  { id: 'public', label: 'Public work page', icon: Globe2 },
  { id: 'dashboard', label: 'Usage & earnings', icon: Activity },
  { id: 'catalogue', label: 'Back catalogue', icon: Archive },
  { id: 'map', label: 'Derivative map', icon: GitFork },
] as const;
type Route = typeof pages[number]['id'];
type State = { draft: Draft; terms: Terms; publication: Publication };
const storageKey = 'folio-studio-v1';

function restore(): State {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const state: State = JSON.parse(saved);
      if (typeof state.draft?.body === 'string' && state.publication?.fingerprint && state.terms?.reading) return state;
    }
  } catch { /* The editor still works when local storage is unavailable. */ }
  return { draft: initialDraft, terms: defaultTerms, publication: seedPublication };
}

function currentRoute(): Route {
  return pages.find(page => '#' + page.id === location.hash)?.id ?? 'editor';
}

export default function App() {
  const initial = restore();
  const [draft, setDraft] = createSignal(initial.draft);
  const [terms, setTerms] = createSignal(initial.terms);
  const [publication, setPublication] = createSignal(initial.publication);
  const [route, setRoute] = createSignal<Route>(currentRoute());
  const [saved, setSaved] = createSignal(true);
  const [announcement, setAnnouncement] = createSignal('');
  let content!: HTMLElement;
  const dirty = createMemo(() => !sameWork(draft(), terms(), publication()));
  const ready = createMemo(() => Boolean(draft().title.trim() && draft().body.trim()));

  function syncRoute() { setRoute(currentRoute()); }
  window.addEventListener('hashchange', syncRoute);
  onCleanup(() => window.removeEventListener('hashchange', syncRoute));

  createEffect(() => {
    const state = { draft: draft(), terms: terms(), publication: publication() };
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      setSaved(true);
    } catch { setSaved(false); }
  });

  let firstPage = true;
  createEffect(() => {
    route();
    if (firstPage) { firstPage = false; return; }
    window.scrollTo(0, 0);
    content.focus({ preventScroll: true });
    const motion = gsap.matchMedia();
    motion.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(content, { opacity: .45, y: 6 }, { opacity: 1, y: 0, duration: .24, clearProps: 'opacity,transform' });
    });
    onCleanup(() => motion.revert());
  });

  const changeDraft = (update: Partial<Draft>) => setDraft(previous => ({ ...previous, ...update }));
  function publishDraft() {
    if (!ready() || !dirty()) return;
    const snapshot = publish(draft(), terms(), publication().version + 1);
    setPublication(snapshot);
    setAnnouncement('Version ' + snapshot.version + ' published.');
    location.hash = 'public';
  }

  return (
    <div class="shell">
      <a class="skip-link" href="#main-content" onClick={event => { event.preventDefault(); content.focus(); }}>Skip to main content</a>
      <aside class="sidebar">
        <a class="brand" href="#editor" aria-label="Folio Rights Studio">
          <img src={import.meta.env.BASE_URL + 'folio.svg'} width="40" height="40" alt="" />
          <span><strong>Folio<span>.</span></strong><small>RIGHTS STUDIO</small></span>
        </a>
        <nav class="sidebar-nav" aria-label="Workspace">
          <p>WORKSPACE</p>
          <For each={pages}>{page => (
            <a href={'#' + page.id} aria-current={route() === page.id ? 'page' : undefined} classList={{ active: route() === page.id }}>
              <page.icon size={18} stroke-width={1.75} /><span>{page.label}</span>
            </a>
          )}</For>
        </nav>
        <div class="sidebar-bottom">
          <div class="profile"><span class="avatar">MV</span><span><strong>{author}</strong><small>Independent journalist</small></span></div>
        </div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <div class="breadcrumb"><span>My work</span><ChevronRight size={15} /><strong>{draft().title || 'Untitled piece'}</strong></div>
          <span class="save-status" role="status"><Show when={saved()} fallback={<CircleHelp size={15} />}><Check size={15} /></Show>{saved() ? 'Saved locally' : 'Session only'}</span>
        </header>
        <main class="main" id="main-content" tabIndex={-1} ref={content}>
          <span class="sr-only" role="status">{announcement()}</span>
          <Switch>
            <Match when={route() === 'editor'}><Editor draft={draft()} dirty={dirty()} onChange={changeDraft} /></Match>
            <Match when={route() === 'licence'}><Licence terms={terms()} onChange={setTerms} publish={publishDraft} ready={ready()} dirty={dirty()} /></Match>
            <Match when={route() === 'public'}><PublicWork publication={publication()} dirty={dirty()} /></Match>
            <Match when={route() === 'dashboard'}><Dashboard currentVersion={publication().version} /></Match>
            <Match when={route() === 'catalogue'}><BackCatalogue /></Match>
            <Match when={route() === 'map'}><DerivativeMap /></Match>
          </Switch>
        </main>
      </div>
    </div>
  );
}

function Editor(props: { draft: Draft; dirty: boolean; onChange: (update: Partial<Draft>) => void }) {
  const result = createMemo(() => assess(props.draft));
  return (
    <>
      <div class="page-heading editor-heading">
        <div>
          <div class="eyebrow"><Feather size={14} /> EDITORIAL STUDIO</div>
          <h1>Write & value<span>.</span></h1>
          <p>Shape your story and see what it could be worth.</p>
        </div>
        <a class="button primary" href="#licence"><Scale size={16} /> Review licence</a>
      </div>
      <div class="editor-layout">
        <section class="card draft-card" aria-labelledby="draft-heading">
          <div class="card-head">
            <div class="card-title"><FileText size={18} /><h2 id="draft-heading">Your draft</h2></div>
            <span class="pill neutral"><span class="status-dot"></span>{props.dirty ? 'Unpublished changes' : 'Up to date'}</span>
          </div>
          <div class="editor-meta">
            <label>Topic<select value={props.draft.topic} onChange={event => props.onChange({ topic: event.currentTarget.value })}><For each={topics}>{topic => <option>{topic.name}</option>}</For></select></label>
            <label>Authorship<select value={props.draft.disclosure} onChange={event => props.onChange({ disclosure: event.currentTarget.value as Draft['disclosure'] })}><option>Human-made</option><option>AI-assisted</option></select></label>
          </div>
          <div class="draft-sheet">
            <label class="sr-only" for="draft-title">Story title</label>
            <input id="draft-title" class="story-title" maxlength={160} placeholder="Untitled piece" value={props.draft.title} onInput={event => props.onChange({ title: event.currentTarget.value })} />
            <div class="story-rule"></div>
            <label class="sr-only" for="draft-body">Story text</label>
            <textarea id="draft-body" class="story-body" placeholder="Start writing or paste your story here…" value={props.draft.body} onInput={event => props.onChange({ body: event.currentTarget.value })} spellcheck={false} />
          </div>
          <div class="draft-footer"><span><FileText size={14} /> {wordCount(props.draft.body)} words</span><a href="#public">View published version </a></div>
        </section>
        <aside class="card valuation" aria-labelledby="valuation-heading">
          <div class="card-head">
            <div class="card-title"><span class="valuation-icon"><Sparkles size={17} /></span><h2 id="valuation-heading">Value estimate</h2></div>
            <span class="pill green"><span class="status-dot"></span>Live</span>
          </div>
          <div class="valuation-body">
            <div class="estimate">
              <p class="estimate-label">ESTIMATED READER PRICE</p>
              <p class="estimate-price">{money(result().low)} <span>–</span> {money(result().high)}</p>
              <div class="confidence"><span class="pill green">{result().confidence >= 75 ? 'High' : result().confidence >= 45 ? 'Moderate' : 'Low'} confidence</span><span>{result().confidence}%</span></div>
              <p class="estimate-summary">{result().summary}</p>
            </div>
            <div class="factors">
              <h3>What drives this estimate</h3>
              <For each={result().scores}>{factor => (
                <div class="factor" title={factor.reason}>
                  <div><span>{factor.name}</span><strong>{factor.score}<small>/100</small></strong></div>
                  <meter min="0" max="100" value={factor.score} aria-label={factor.name} />
                </div>
              )}</For>
            </div>
            <Suggestions draft={props.draft} />
            <details class="valuation-notes">
              <summary><CircleHelp size={15} /> About this estimate</summary>
              <p>Folio uses reporting signals and a reference index of topic demand to suggest a reader price. Confidence reflects the evidence available in this draft.</p>
              <ul><For each={result().scores}>{factor => <li><strong>{factor.name}</strong> {factor.reason}</li>}</For></ul>
            </details>
          </div>
        </aside>
      </div>
      <footer class="page-footer"><BookOpen size={15} /> Folio Rights Studio</footer>
    </>
  );
}
