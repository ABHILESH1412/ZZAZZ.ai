import { assess, topics } from './model';

export type CatalogueWork = { title: string; text: string; topic: string; publishedAt: string };
const requiredColumns = ['title', 'text', 'topic', 'published_at'];
export const maximumImportSize = 1_000_000;

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let state: 'field' | 'quoted' | 'closed' = 'field';
  const finishField = () => { row.push(value); value = ''; state = 'field'; };
  const finishRow = () => { finishField(); if (row.some(cell => cell.trim())) rows.push(row); row = []; };

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (state === 'quoted') {
      if (char !== '"') value += char;
      else if (text[index + 1] === '"') { value += '"'; index++; }
      else state = 'closed';
      continue;
    }
    if (char === ',') finishField();
    else if (char === '\n' || char === '\r') {
      finishRow();
      if (char === '\r' && text[index + 1] === '\n') index++;
    } else if (char === '"' && state === 'field' && !value) state = 'quoted';
    else if (state === 'closed' || char === '"') throw new Error('Check quotation marks in the CSV. Quote fields that contain commas or newlines.');
    else value += char;
  }
  if (state === 'quoted') throw new Error('A CSV field has an unclosed quotation mark.');
  finishRow();
  return rows;
}

function importRows(input: string): unknown[] {
  const text = input.trimStart();
  if (!text.trim()) throw new Error('Add at least one piece to import.');
  if (text.startsWith('[') || text.startsWith('{')) {
    let json: unknown;
    try { json = JSON.parse(text); }
    catch { throw new Error('The JSON could not be read. Check its syntax and try again.'); }
    if (!Array.isArray(json)) throw new Error('Use a JSON array with one object per piece.');
    return json;
  }
  const [header, ...rows] = csvRows(text);
  const columns = header?.map(cell => cell.trim().toLowerCase()) ?? [];
  if (!columns.includes('title')) throw new Error('Start the CSV with a header row containing a title column.');
  if (new Set(columns).size !== columns.length) throw new Error('Use each CSV header only once.');
  if (rows.some(row => row.length !== columns.length)) throw new Error('Each CSV row must have the same number of fields as the header.');
  return rows.map(row => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
}

function clean(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }

function readWork(value: unknown, index: number): CatalogueWork {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Piece ' + (index + 1) + ' must have a title.');
  const row = value as Record<string, unknown>;
  const title = clean(row.title);
  if (!title || title.length > 160) throw new Error('Piece ' + (index + 1) + ' needs a title of 1 to 160 characters.');
  for (const key of requiredColumns) {
    if (row[key] != null && typeof row[key] !== 'string') throw new Error('Piece ' + (index + 1) + ' has a non-text ' + key + ' field.');
  }
  const text = clean(row.text);
  const publishedAt = clean(row.published_at);
  if (publishedAt && (!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt) || !Number.isFinite(Date.parse(publishedAt)) ||
      new Date(publishedAt).toISOString().slice(0, 10) !== publishedAt || publishedAt > new Date().toISOString().slice(0, 10))) {
    throw new Error('Use a valid past date in YYYY-MM-DD format for piece ' + (index + 1) + '.');
  }
  const topic = clean(row.topic);
  const explicit = topics.find(item => item.name.toLowerCase() === topic.toLowerCase());
  const words = new Set((title + ' ' + text).toLowerCase().match(/[\p{L}\p{N}]+/gu));
  const ranked = topics.map(item => ({ item, matches: item.words.filter(word => words.has(word)).length }))
    .sort((a, b) => b.matches - a.matches);
  return { title, text, topic: (explicit ?? (ranked[0].matches ? ranked[0].item : topics[3])).name, publishedAt };
}

export function parseCatalogue(input: string) {
  if (new TextEncoder().encode(input).length > maximumImportSize) throw new Error('Use an import file smaller than 1 MB.');
  const rows = importRows(input);
  if (!rows.length) throw new Error('Add at least one piece to import.');
  return rows.map(readWork);
}

export function mergeCatalogue(current: CatalogueWork[], incoming: CatalogueWork[]) {
  const key = (row: CatalogueWork) => row.title.toLowerCase().replace(/\s+/g, ' ') + '\u0000' + row.publishedAt;
  const works = new Map(current.map(row => [key(row), row]));
  const previous = works.size;
  for (const row of incoming) works.set(key(row), row);
  const added = works.size - previous;
  return { works: [...works.values()], added, updated: new Set(incoming.map(key)).size - added };
}

export function valueArchive(work: CatalogueWork, now = Date.now()) {
  const age = work.publishedAt ? Math.max(0, now - Date.parse(work.publishedAt)) / 86_400_000 : null;
  const freshness = age === null ? .65 : Math.max(.2, 365 / (365 + age));
  const value = assess({ title: work.title, topic: work.topic, body: work.text, disclosure: 'Human-made' }, freshness);
  const [originality, , depth, demand] = value.scores.map(factor => factor.score);
  if (!work.text || value.confidence < 45) {
    return { ...value, priority: 2, label: 'Add more text', guidance: 'Import the full piece or a detailed description to get a more reliable estimate.' };
  }
  if (value.high >= 200 && originality + depth >= 115 && demand >= 50) {
    return { ...value, priority: 0, label: 'Price now', guidance: 'Original reporting and buyer interest support a paid licence. Start within the suggested range.' };
  }
  return { ...value, priority: 1, label: 'Refresh first', guidance: demand < 50 ? 'Clarify the topic and consider what a buyer would use this work for today.' :
    'Update time-sensitive details and add current context before setting a price.' };
}

export const initialCatalogue: CatalogueWork[] = [
  {
    title: 'Where the floodwater goes', topic: 'Climate & environment', publishedAt: '2025-10-18',
    text: 'I visited all five pumping stations along the southern coast and interviewed 12 residents who were moved during last winter’s flood. Municipal water records trace how four gates diverted water away from the freight yards and into a residential street for six consecutive days. “The warning arrived after the steps were already underwater,” said tenant Lio Fen. The latest engineering study compares energy costs, flood gates and drainage at 19 sites. It projects more coastal flooding and a 28 percent increase in heat exposure. The council will vote on seven replacement pump designs next month. Three maps show which blocks could benefit under each proposal and how the original forest buffer changed.',
  },
  {
    title: 'The last repair café', topic: 'Culture & community', publishedAt: '2025-04-06',
    text: 'At the community repair café, volunteers meet every month to repair broken lamps, toasters and radios. I interviewed one organizer who described a steady decline in attendance. The hall’s booking records show 27 sessions over three years. A small photo archive follows how three volunteers have learned to pass on their skills. The project is part of a wider discussion about what the neighborhood can keep when the hall is sold.',
  },
  {
    title: 'A week on the municipal night bus', topic: 'Cities & infrastructure', publishedAt: '2024-09-12',
    text: 'Notes on passengers and drivers along a municipal night bus route.',
  },
];
