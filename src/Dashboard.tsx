import { createMemo, createSignal, For, Show } from 'solid-js';
import { Activity, Bot, CalendarDays, ChartNoAxesCombined, CircleDollarSign, Flag, GitFork, ListFilter, Receipt, Users } from 'lucide-solid';
import { activity, derivativeActivity, derivativeMinimum, money, uses, type Use } from './model';

type Audience = 'All audiences' | 'Human' | 'AI';
const reportEntry = activity.find(entry => entry.held)!;
const labels = Object.fromEntries(uses.map(use => [use.id, use.label]));
const total = (entries: typeof activity) => entries.reduce((sum, entry) => sum + entry.cents, 0);

export default function Dashboard(props: { currentVersion: number }) {
  const [audience, setAudience] = createSignal<Audience>('All audiences');
  const [use, setUse] = createSignal<Use | 'All uses'>('All uses');
  const [page, setPage] = createSignal(0);
  const pageSize = 8;
  const rows = createMemo(() => activity.filter(row => (audience() === 'All audiences' || row.audience === audience()) && (use() === 'All uses' || row.use === use())));
  const pageCount = () => Math.ceil(rows().length / pageSize);
  const current = () => rows().slice(page() * pageSize, (page() + 1) * pageSize);
  const cleared = activity.filter(entry => !entry.held);
  const derivatives = derivativeActivity;
  const cumulative = Array.from({ length: 31 }, (_, day) => total(cleared.filter(entry => entry.day <= day)));
  const max = Math.ceil(cumulative[30] / 20000) * 20000;
  const chartPoints = cumulative.map((value, index) => [12 + index * 20, 170 - (value / max) * 152].join(',')).join(' ');

  return (
    <>
      <div class="page-heading">
        <div><div class="eyebrow"><Activity size={15} /> PERFORMANCE</div><h1>Usage & earnings<span>.</span></h1><p>See where your work went, who used it, and what they paid.</p></div>
        <span class="date-tag"><CalendarDays size={17} /> October 2026</span>
      </div>
      <Show when={props.currentVersion > 1}><p class="notice"><Receipt size={17} /> October activity belongs to version 1. No transactions are recorded for version {props.currentVersion}.</p></Show>
      <div class="stats">
        <div class="card stat"><span class="soft-icon"><CircleDollarSign size={19} /></span><div><p>Cleared earnings</p><strong>{money(total(cleared))}</strong></div></div>
        <div class="card stat"><span class="soft-icon"><Users size={19} /></span><div><p>Human uses</p><strong>{activity.filter(entry => entry.audience === 'Human').length}</strong></div></div>
        <div class="card stat"><span class="soft-icon"><Bot size={19} /></span><div><p>AI uses</p><strong>{activity.filter(entry => entry.audience === 'AI').length}</strong></div></div>
        <div class="card stat"><span class="soft-icon"><GitFork size={19} /></span><div><p>Derivative earnings</p><strong>{money(total(derivatives))}</strong></div></div>
      </div>
      <div class="detail-grid dashboard-grid">
        <section class="card">
          <div class="card-head"><div class="card-title"><ChartNoAxesCombined size={18} /><h2>Earnings over time</h2></div><span class="pill green">Cumulative</span></div>
          <div class="card-padding chart">
            <div class="chart-y"><span>{money(max, true)}</span><span>{money(max / 2, true)}</span><span>$0</span></div>
            <div class="chart-plot">
              <svg viewBox="0 0 624 180" preserveAspectRatio="none" role="img" aria-label={'Cumulative cleared earnings grew from $0 to ' + money(cumulative[30]) + ' over 30 days in October.'}>
                <defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#abc5ac" stop-opacity=".72" /><stop offset="1" stop-color="#abc5ac" stop-opacity=".08" /></linearGradient></defs>
                <path d="M0 18H624 M0 94H624 M0 170H624" fill="none" stroke="#e4e4da" stroke-dasharray="5 5" />
                <polygon points={'12,170 ' + chartPoints + ' 612,170'} fill="url(#chart-fill)" />
                <polyline points={chartPoints} fill="none" stroke="#416b51" stroke-width="2.5" vector-effect="non-scaling-stroke" />
              </svg>
              <div class="chart-x"><span>Oct 1</span><span>Oct 10</span><span>Oct 20</span><span>Oct 30</span></div>
            </div>
          </div>
        </section>
        <section class="card">
          <div class="card-head"><div class="card-title"><Receipt size={18} /><h2>Uses by licence</h2></div></div>
          <div class="card-padding licence-breakdown"><For each={uses}>{definition => {
            const entries = activity.filter(entry => entry.use === definition.id);
            return <div><div><strong>{definition.label}</strong><span>{entries.length} uses · {money(total(entries.filter(entry => !entry.held)))}</span></div><meter min="0" max={activity.length} value={entries.length} aria-label={definition.label} /></div>;
          }}</For></div>
        </section>
      </div>
      <section class="card activity-card">
        <div class="card-head"><div class="card-title"><Activity size={18} /><h2>Usage activity</h2></div><span class="pill neutral">Version 1</span></div>
        <div class="activity-filters"><ListFilter size={17} /><label><span class="sr-only">Filter by audience</span><select value={audience()} onChange={event => { setAudience(event.currentTarget.value as Audience); setPage(0); }}><option>All audiences</option><option value="Human">People</option><option value="AI">AI systems</option></select></label><label><span class="sr-only">Filter by licence</span><select value={use()} onChange={event => { setUse(event.currentTarget.value as Use | 'All uses'); setPage(0); }}><option>All uses</option><For each={uses}>{item => <option value={item.id}>{item.label}</option>}</For></select></label></div>
        <div class="table-scroll" tabIndex={0} role="region" aria-label="Usage transactions">
          <table><thead><tr><th scope="col">Buyer</th><th scope="col">Audience</th><th scope="col">Licence</th><th scope="col">Date</th><th scope="col">Amount</th><th scope="col">Status</th></tr></thead>
          <tbody><For each={current()} fallback={<tr><td colSpan={6}>No transactions match these filters.</td></tr>}>{entry => <tr><th scope="row">{entry.buyer}</th><td>{entry.audience}</td><td>{labels[entry.use]}</td><td>Oct {entry.day}</td><td>{money(entry.cents)}</td><td><span class={'pill ' + (entry.held ? 'warning' : 'green')}>{entry.held ? 'On hold' : 'Cleared'}</span></td></tr>}</For></tbody></table>
        </div>
        <div class="pagination"><span>{rows().length ? (page() * pageSize + 1) + '–' + Math.min((page() + 1) * pageSize, rows().length) + ' of ' + rows().length : '0 results'}</span><div><button type="button" class="button small" disabled={page() === 0} onClick={() => setPage(previous => previous - 1)}>Previous</button><button type="button" class="button small" disabled={page() + 1 >= pageCount()} onClick={() => setPage(previous => previous + 1)}>Next</button></div></div>
      </section>
      <div class="detail-grid dashboard-grid">
        <section class="card">
          <div class="card-head"><div class="card-title"><GitFork size={18} /><h2>Derivative works</h2></div><a class="button small" href="#map">View map</a></div>
          <div class="card-padding derivatives"><For each={derivatives}>{entry => <div><div><strong>{entry.derivative.title}</strong><p>{entry.derivative.kind} · {entry.buyer}</p><p>Source {entry.derivative.sourceId} · {entry.derivative.rate * 100}% share of {money(entry.derivative.gross)} gross · {money(derivativeMinimum)} minimum</p></div><strong>{money(entry.cents)}</strong></div>}</For></div>
        </section>
        <section class="card">
          <div class="card-head"><div class="card-title"><Flag size={18} /><h2>Buyer reports</h2></div><span class="pill warning">Under review</span></div>
          <div class="card-padding report"><h3>Ridership claim disputed</h3><p>{reportEntry.buyer} · Oct {reportEntry.day} · Version {reportEntry.version}</p><p>The buyer asked whether the reported 31% increase was measured on Line 4 or across the city.</p><p><strong>{money(reportEntry.cents)} held</strong> while a reviewer checks the source records. Other earnings continue to clear.</p><details><summary>Review process</summary><p>The creator can respond with records before a decision. A resolved report releases the payment if the claim is supported or refunds the disputed transaction if it is upheld.</p></details></div>
        </section>
      </div>
    </>
  );
}
