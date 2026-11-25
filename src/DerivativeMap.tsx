import { createMemo, createSignal, For, Show, type Accessor } from 'solid-js';
import { CalendarDays, CircleDollarSign, FileText, GitFork, Languages, Mic, Receipt, ScrollText } from 'lucide-solid';
import { derivativeActivity, derivativeMinimum, localDate, money, originalWorkId, seedPublication, type Derivative } from './model';

type Branch = typeof derivativeActivity[number];
const byType = { Translation: Languages, 'Expanded summary': ScrollText, 'Audio clip': Mic, 'Syndicated copy': FileText };
const total = derivativeActivity.reduce((sum, branch) => sum + branch.cents, 0);
const name = (id: string) => derivativeActivity.find(branch => branch.derivative.id === id)?.derivative.title ?? seedPublication.draft.title;
const getChildren = (parent: string) => derivativeActivity.filter(branch => branch.derivative.sourceId === parent).sort((a, b) => a.day - b.day);

function Branches(props: { parent: string; selected: Accessor<string>; select: (nodeId: string) => void }) {
  const children = getChildren(props.parent);
  return <Show when={children.length}>
    <ul class="lineage-branches">
      <For each={children}>{branch => {
        const work = branch.derivative;
        const Icon = byType[work.kind];
        return <li>
          <button type="button" class="lineage-node" classList={{ 'lineage-selected': props.selected() === work.id }} aria-pressed={props.selected() === work.id} aria-controls="lineage-details" onClick={() => props.select(work.id)}>
            <span class="soft-icon"><Icon size={17} /></span>
            <span class="lineage-label"><small>{work.kind}</small><strong>{work.title}</strong></span>
            <span class="lineage-money" aria-label={money(branch.cents) + ' credited to original'}>+{money(branch.cents)}</span>
          </button>
          <Branches parent={work.id} selected={props.selected} select={props.select} />
        </li>;
      }}</For>
    </ul>
  </Show>;
}

export default function DerivativeMap() {
  const [selected, setSelected] = createSignal(originalWorkId);
  const current = createMemo(() => derivativeActivity.find(branch => branch.derivative.id === selected()));
  const root = seedPublication;
  return <>
    <div class="page-heading">
      <div><div class="eyebrow"><GitFork size={15} /> ATTRIBUTION</div><h1>Derivative map<span>.</span></h1><p>Follow how a story was reused and how each use paid the original creator.</p></div>
      <span class="date-tag"><CalendarDays size={17} /> October 2026</span>
    </div>
    <div class="map-layout">
      <section class="card map-card">
        <div class="card-head"><div class="card-title"><GitFork size={18} /><h2>Publication lineage</h2></div><span class="pill neutral">Version {root.version}</span></div>
        <div class="card-padding lineage-tree">
          <button type="button" class="lineage-node lineage-root" classList={{ 'lineage-selected': selected() === originalWorkId }} aria-pressed={selected() === originalWorkId} aria-controls="lineage-details" onClick={() => setSelected(originalWorkId)}>
            <span class="soft-icon"><FileText size={18} /></span><span class="lineage-label"><small>Original publication</small><strong>{root.draft.title}</strong></span>
          </button>
          <Branches parent={originalWorkId} selected={selected} select={setSelected} />
        </div>
        <p class="map-caption">Amounts show each work’s payout to {root.author}. Select a work for the terms behind its payout.</p>
      </section>
      <aside class="card map-detail" id="lineage-details" aria-live="polite">
        <div class="card-head"><div class="card-title"><Receipt size={18} /><h2>Attribution & payout</h2></div></div>
        <div class="card-padding">
          <Show when={current()} fallback={<>
            <div class="eyebrow">ORIGINAL PUBLICATION</div>
            <h3>{root.draft.title}</h3>
            <p class="muted">{root.author} · {localDate(root.publishedAt)}</p>
            <div class="map-total"><CircleDollarSign size={21} /><div><span>Total returned to creator</span><strong>{money(total)}</strong></div></div>
            <p class="muted">{derivativeActivity.length} licensed derivatives across {getChildren(originalWorkId).length} branches.</p>
          </>}>{branch => <BranchDetails branch={branch()} />}</Show>
          <a class="button small" href="#dashboard">View earnings</a>
        </div>
      </aside>
    </div>
  </>;
}

function BranchDetails(props: { branch: Branch }) {
  const work = (): Derivative => props.branch.derivative;
  const calculatedShare = () => Math.round(work().gross * work().rate);
  return <>
    <div class="eyebrow">{work().kind}</div>
    <h3>{work().title}</h3>
    <p class="muted">{props.branch.buyer} · Oct {props.branch.day}, 2026</p>
    <dl class="payout-details">
      <div><dt>Adapted from</dt><dd>{name(work().sourceId)}</dd></div>
      <div><dt>Gross revenue</dt><dd>{money(work().gross)}</dd></div>
      <div><dt>{work().rate * 100}% share</dt><dd>{money(calculatedShare())}</dd></div>
      <div><dt>Licence minimum</dt><dd>{money(derivativeMinimum)}</dd></div>
    </dl>
    <div class="map-total"><CircleDollarSign size={21} /><div><span>{calculatedShare() < derivativeMinimum ? 'Minimum paid to original creator' : 'Share paid to original creator'}</span><strong>{money(props.branch.cents)}</strong></div></div>
  </>;
}
