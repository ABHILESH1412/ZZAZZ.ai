import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export const uses = [
  { id: 'reading', label: 'Human reading', detail: 'Read the full piece for personal use.', buyer: 'Human' },
  { id: 'quotation', label: 'AI quotation', detail: 'Quote or summarize the piece in an AI answer.', buyer: 'AI' },
  { id: 'training', label: 'AI model training', detail: 'Use the piece as training data for a model.', buyer: 'AI' },
  { id: 'reuse', label: 'Republishing and remixing', detail: 'Publish a translation, adaptation, or excerpt.', buyer: 'Human' },
] as const;
export type Use = typeof uses[number]['id'];
export type Permission = 'allowed' | 'approval' | 'prohibited';
export type Terms = Record<Use, { permission: Permission; cents: number }>;
export type Draft = { title: string; body: string; topic: string; disclosure: 'Human-made' | 'AI-assisted' };
export type Publication = { version: number; author: string; publishedAt: string; draft: Draft; terms: Terms; fingerprint: string };
export type Derivative = { id: string; title: string; kind: 'Translation' | 'Expanded summary' | 'Audio clip' | 'Syndicated copy'; gross: number; rate: number; sourceId: string };
export type Entry = { id: number; day: number; buyer: string; audience: 'Human' | 'AI'; use: Use; cents: number; held: boolean; version: number; derivative?: Derivative };

export const author = 'Mara Vale';
export const topics = [
  { name: 'Cities & infrastructure', demand: 76, words: ['tram', 'transit', 'rail', 'bus', 'housing', 'street', 'municipal', 'commute', 'platform', 'ridership'] },
  { name: 'Climate & environment', demand: 86, words: ['climate', 'flood', 'energy', 'heat', 'emissions', 'water', 'coast', 'forest'] },
  { name: 'Technology & society', demand: 82, words: ['technology', 'model', 'software', 'privacy', 'algorithm', 'platform', 'automation', 'robot'] },
  { name: 'Culture & community', demand: 61, words: ['culture', 'music', 'festival', 'museum', 'community', 'art', 'theatre', 'archive'] },
];
export const initialDraft: Draft = {
  title: 'The city after midnight',
  topic: topics[0].name,
  disclosure: 'Human-made',
  body: `At 12:47 a.m., the last tram pulls out of Bellhaven’s Central Quay with eleven people on board. A baker heading to the morning shift. Two cleaners in navy uniforms. A nurse who has made this same trip for eight years.

For most of the city, the day is over. For the people on Line 4, it is only beginning.

Over six weeks, I rode the entire night route and interviewed 14 passengers and five tram operators. Ridership records obtained from the Bellhaven Transit Office show that late-night use rose 31 percent last winter, even as the city reduced service to one tram an hour.

“We used to know each other by face,” said conductor Elin Rook. “Now we know each other by who can still make the connection.”

The latest municipal budget sets aside 2.4 million for station upgrades. It includes a single line about night service, with a decision due next month. On the eastern end of the route, a missed tram already means a 40-minute walk past closed warehouses.

On my last ride, the nurse pointed out three lit windows above the old harbor wall. One belonged to her neighbor. The other two, she said, were probably people getting ready for work.`,
};
export const defaultTerms: Terms = {
  reading: { permission: 'allowed', cents: 400 },
  quotation: { permission: 'allowed', cents: 150 },
  training: { permission: 'approval', cents: 35000 },
  reuse: { permission: 'approval', cents: 4500 },
};

export const money = (cents: number, whole = false) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: whole ? 0 : 2, minimumFractionDigits: whole ? 0 : 2,
}).format(cents / 100);
export const localDate = (datetime: string) => new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(datetime));
export const wordCount = (value: string) => tokenize(value).length;
const tokenize = (value: string) => value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function assess(draft: Draft, freshness = 1) {
  const words = tokenize(draft.body);
  const distinct = new Set(words);
  const sentences = draft.body.toLowerCase().split(/[.!?\n]+/)
    .map(part => tokenize(part).join(' ')).filter(Boolean);
  const sourceSignals = [/\b(interviewed|interview|spoke with)\b/i, /\b(records|documents|data|dataset)\b/i, /\b(observed|visited|i rode|field notes)\b/i, /[“"][^“”"\n]{18,}[”"]/].filter(pattern => pattern.test(draft.body)).length;
  const evidence = new Set(draft.body.match(/\b\d+(?:[.:]\d+)?\b/g) ?? []).size;
  const timeSignals = [/\b(latest|recent|this week|today)\b/i, /\b(next month|next week|deadline|due)\b/i, /\b(last winter|last month|this year|20\d{2})\b/i].filter(pattern => pattern.test(draft.body)).length;
  const topic = topics.find(item => item.name === draft.topic) ?? topics[0];
  const topicMatches = topic.words.filter(word => distinct.has(word)).length;
  const coverage = Math.min(1, distinct.size / 100);
  const repetition = sentences.length ? new Set(sentences).size / sentences.length : 0;
  const wordVariety = words.length ? distinct.size / words.length : 0;
  const quality = Math.min(1, wordVariety / .43) * repetition;
  const scores = [
    { name: 'Originality', score: clamp((coverage * 28 + sourceSignals * 16) * quality), reason: sourceSignals >= 3 ? 'Firsthand reporting and attributed evidence.' : 'Add firsthand observations, interviews, or source records.' },
    { name: 'Timeliness', score: clamp((coverage * 39 + timeSignals * 12) * quality * freshness), reason: timeSignals >= 2 ? 'Several cues explain why the story matters now.' : 'Connect the story to a date or upcoming decision.' },
    { name: 'Depth', score: clamp((coverage * 43 + Math.min(evidence, 5) * 6 + sourceSignals * 4) * quality), reason: evidence >= 3 ? 'Concrete figures and multiple reporting details.' : 'Add specific figures and explain what they show.' },
    { name: 'Topic demand', score: clamp(topic.demand * Math.min(1, topicMatches / 4) * coverage * quality), reason: topicMatches >= 4 ? 'The draft fits a topic with an estimated level of buyer interest.' : 'Make the selected topic clearer in the reporting.' },
  ];
  const confidence = clamp(coverage * 64 + sourceSignals * 6 - (1 - quality) * 30);
  const score = scores.reduce((sum, factor, index) => sum + factor.score * [.34, .16, .32, .18][index], 0);
  const center = coverage * (score * 1.05 + score ** 2 / 54) / 100;
  const range = .25 + (100 - confidence) / 175;
  return { scores, confidence, words: words.length, low: Math.floor(center * (1 - range) * 4) * 25, high: Math.ceil(center * (1 + range) * 4) * 25,
    summary: score >= 70 ? 'Firsthand reporting and specific evidence make this story valuable to readers looking for original coverage.' : score >= 36 ? 'The draft has a clear starting point. More original reporting or evidence could justify a higher price.' : 'There’s little evidence for a paid estimate yet. Add reporting details before setting a price.',
  };
}

export function termsSummary(terms: Terms) {
  return uses.map(({ id, label }) => {
    const choice = terms[id];
    const amount = choice.cents ? money(choice.cents) : 'no charge';
    if (choice.permission === 'prohibited') return label + ' is prohibited.';
    if (choice.permission === 'approval') return label + ' requires creator approval, with a proposed fee of ' + amount + '.';
    return label + ' is allowed at ' + amount + ' per use.';
  }).join(' ');
}

export function termsData(terms: Terms) {
  return { currency: 'USD', unit: 'per_use', permissions: Object.fromEntries(uses.map(({ id }) => {
    const choice = terms[id];
    return [id, { permission: choice.permission, price_cents: choice.permission === 'prohibited' ? null : choice.cents }];
  })) };
}

export function fingerprint(snapshot: Omit<Publication, 'fingerprint'>) {
  const { version, author: creator, publishedAt, draft, terms } = snapshot;
  const payload = [version, creator, publishedAt, draft.title, draft.body, draft.topic, draft.disclosure,
    ...uses.map(({ id }) => [id, terms[id].permission, terms[id].cents])];
  return bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(payload))));
}

export function publish(draft: Draft, terms: Terms, version: number, publishedAt = new Date().toISOString()): Publication {
  const snapshot = { version, author, publishedAt, draft: { ...draft }, terms: structuredClone(terms) };
  return { ...snapshot, fingerprint: fingerprint(snapshot) };
}

export const seedPublication = publish(initialDraft, defaultTerms, 1, '2026-10-01T09:00:00Z');
export const sameWork = (draft: Draft, terms: Terms, current: Publication) =>
  fingerprint({ ...current, draft, terms }) === current.fingerprint;

export function previewText(body: string) {
  const paragraphs = body.trim().split(/\n\s*\n/);
  const preview = paragraphs.slice(0, paragraphs.length > 1 ? 2 : 1).join('\n\n');
  const boundary = Math.min(480, Math.max(1, Math.floor(body.trim().length * .65)));
  return preview.length <= boundary ? preview : preview.slice(0, boundary).replace(/\s+\S*$/, '') + '…';
}

export const derivativeMinimum = defaultTerms.reuse.cents;
export const originalWorkId = 'folio-city-v1';

function derivativeEntry(entry: Omit<Entry, 'cents' | 'derivative' | 'held' | 'use' | 'version'>, derivative: Derivative): Entry {
  return {
    ...entry,
    use: 'reuse', held: false, version: 1,
    cents: Math.max(derivativeMinimum, Math.round(derivative.gross * derivative.rate)),
    derivative,
  };
}

const readers = ['Iona Fen', 'Felix Pell', 'Tessa Oren', 'Nico Venn', 'Mina Ard', 'Orin Tess', 'Dara Quill', 'Alba Keen'];
const systems = ['Harbor Guide AI', 'Kestrel Answers', 'Lowlight Search', 'Threadwell Assistant'];

export const activity: Entry[] = Array.from({ length: 30 }, (_, index) => {
  const day = index + 1;
  const rows: Entry[] = [];
  const count = [2, 3, 1, 4, 2, 5, 3][(day * 11) % 7];
  for (let position = 0; position < count; position++) {
    const ai = (day * 7 + position * 3) % 8 < 3;
    const use = ai ? 'quotation' : 'reading';
    rows.push({ id: day * 10 + position, day, buyer: ai ? systems[(day + position) % systems.length] : readers[(day * 3 + position) % readers.length], audience: ai ? 'AI' : 'Human', use, cents: defaultTerms[use].cents, held: day === 26 && position === 0, version: 1 });
  }
  return rows;
}).flat();
activity.push(
  derivativeEntry({ id: 701, day: 6, buyer: 'The Alder Dispatch', audience: 'Human' },
    { id: 'alder-translation', title: 'La ciudad después de medianoche', kind: 'Translation', gross: 19200, rate: .25, sourceId: originalWorkId }),
  derivativeEntry({ id: 702, day: 17, buyer: 'Threadwell Assistant', audience: 'AI' },
    { id: 'threadwell-summary', title: 'What the last tram tells us', kind: 'Expanded summary', gross: 13200, rate: .25, sourceId: originalWorkId }),
  derivativeEntry({ id: 703, day: 24, buyer: 'Cinderline Audio', audience: 'Human' },
    { id: 'cinderline-clip', title: 'Last ride on Line 4', kind: 'Audio clip', gross: 21600, rate: .25, sourceId: originalWorkId }),
  derivativeEntry({ id: 705, day: 29, buyer: 'The Serrin Chronicle', audience: 'Human' },
    { id: 'serrin-reprint', title: 'La ciudad después de medianoche, edición del domingo', kind: 'Syndicated copy', gross: 24400, rate: .25, sourceId: 'alder-translation' }),
  { id: 704, day: 28, buyer: 'Sable Index Labs', audience: 'AI', use: 'training', cents: 35000, held: false, version: 1 },
);
activity.sort((a, b) => b.day - a.day || b.id - a.id);

export const derivativeActivity = activity.filter((entry): entry is Entry & { derivative: Derivative } => Boolean(entry.derivative));
