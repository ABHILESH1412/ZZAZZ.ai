import { createMemo, createSignal, For, Show } from 'solid-js';
import { Archive, FileUp, LibraryBig, ListFilter } from 'lucide-solid';
import { initialCatalogue, maximumImportSize, mergeCatalogue, parseCatalogue, valueArchive, type CatalogueWork } from './catalogue';
import { money } from './model';

const storageKey = 'folio-catalogue-v1';

function restore() {
  try {
    const local = localStorage.getItem(storageKey);
    if (local) {
      const rows: unknown = JSON.parse(local);
      if (Array.isArray(rows) && rows.every(row => row && ['title', 'text', 'topic', 'publishedAt'].every(key => typeof row[key] === 'string'))) {
        return rows as CatalogueWork[];
      }
    }
  } catch { /* Start with the built-in catalogue when local data is unavailable. */ }
  return initialCatalogue;
}

export default function Catalogue() {
  const [works, setWorks] = createSignal(restore());
  const [paste, setPaste] = createSignal('');
  const [message, setMessage] = createSignal('');
  const [error, setError] = createSignal('');
  const [uploading, setUploading] = createSignal(false);
  const [onlyPriority, setOnlyPriority] = createSignal(false);
  const valued = createMemo(() => works().map(work => ({ work, value: valueArchive(work) }))
    .sort((a, b) => a.value.priority - b.value.priority || b.value.high - a.value.high));
  const rows = () => onlyPriority() ? valued().filter(row => row.value.priority === 0) : valued();
  const priorityCount = () => valued().filter(row => row.value.priority === 0).length;

  function importText(input: string) {
    setError('');
    setMessage('');
    try {
      const { works: updatedWorks, added, updated } = mergeCatalogue(works(), parseCatalogue(input));
      localStorage.setItem(storageKey, JSON.stringify(updatedWorks));
      setWorks(updatedWorks);
      setOnlyPriority(false);
      setMessage([added ? added + ' added' : '', updated ? updated + ' updated' : ''].filter(Boolean).join(', ') + '.');
      return true;
    } catch (failure) {
      setError(failure instanceof DOMException ? 'The catalogue could not be saved on this device. Try a smaller import.' :
        failure instanceof Error ? failure.message : 'The list could not be imported.');
      return false;
    }
  }

  async function importFile(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage('');
    setError('');
    try {
      if (file.size > maximumImportSize) throw new Error('Use an import file smaller than 1 MB.');
      importText(await file.text());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The file could not be read.');
    } finally {
      input.value = '';
      setUploading(false);
    }
  }

  return <>
    <div class="page-heading">
      <div><div class="eyebrow"><Archive size={15} /> ARCHIVE</div><h1>Back catalogue<span>.</span></h1><p>Find past work that’s ready to license or worth revisiting.</p></div>
      <span class="date-tag"><LibraryBig size={17} /> {works().length} {works().length === 1 ? 'piece' : 'pieces'} · {priorityCount()} ready to price</span>
    </div>
    <section class="card catalogue-import" aria-labelledby="catalogue-import">
      <div class="card-head">
        <div class="card-title"><FileUp size={18} /><h2 id="catalogue-import">Import past work</h2></div>
        <label class="button primary file-button"><FileUp size={16} /> {uploading() ? 'Reading file…' : 'Upload CSV or JSON'}<input type="file" accept=".csv,.json,text/csv,application/json" disabled={uploading()} aria-label="Upload CSV or JSON" onChange={event => void importFile(event.currentTarget)} /></label>
      </div>
      <div class="card-padding">
        <p class="catalogue-format">Include a <code>title</code> for each piece. Add <code>text</code>, <code>topic</code>, and <code>published_at</code> (YYYY-MM-DD) for a better estimate.</p>
        <details class="catalogue-paste">
          <summary>Paste CSV or JSON</summary>
          <form onSubmit={event => { event.preventDefault(); if (importText(paste())) setPaste(''); }}>
            <label for="catalogue-list" class="sr-only">CSV or JSON list</label>
            <textarea id="catalogue-list" placeholder={'title,text,topic,published_at\nA story title,Article text,Culture & community,2025-06-12'} value={paste()} onInput={event => setPaste(event.currentTarget.value)} />
            <button class="button small" disabled={!paste().trim() || uploading()}>Import list</button>
          </form>
        </details>
        <Show when={message()}><p class="import-success" role="status">{message()}</p></Show>
        <Show when={error()}><p class="ai-error" role="alert">{error()}</p></Show>
      </div>
    </section>

    <section class="card catalogue-results" aria-labelledby="catalogue-results">
      <div class="card-head"><div class="card-title"><LibraryBig size={18} /><h2 id="catalogue-results">Past work</h2></div>
        <button class="button small" classList={{ 'active-filter': onlyPriority() }} aria-pressed={onlyPriority()} onClick={() => setOnlyPriority(previous => !previous)}><ListFilter size={15} /> Ready to price</button>
      </div>
      <For each={rows()} fallback={<p class="card-padding muted">No pieces are ready to price yet.</p>}>{({ work, value }) => (
        <article class="catalogue-row">
          <div class="catalogue-work"><h3>{work.title}</h3><p>{work.topic}{work.publishedAt ? ' · ' + work.publishedAt : ''}</p></div>
          <div class="catalogue-price"><span class="catalogue-price-label">Estimated reader price</span><strong>{money(value.low)}–{money(value.high)}</strong><span>{value.confidence}% confidence</span></div>
          <div class="catalogue-guidance"><span class={'pill ' + (value.priority === 0 ? 'green' : value.priority === 1 ? 'warning' : 'neutral')}>{value.label}</span><p>{value.guidance}</p></div>
        </article>
      )}</For>
    </section>
  </>;
}
