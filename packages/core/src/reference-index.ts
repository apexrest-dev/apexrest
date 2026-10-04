// Shared by the offline corpus builder and the runtime fallback for custom references.
export const referenceWords = (text: string) =>
  text
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) ?? [];
export const normalizeReference = (text: string) => referenceWords(text).join(' ');
export function buildReferencePostings(entries: { id: string; title?: string; text: string }[]) {
  const postings: Record<string, number[]> = Object.create(null);
  entries.forEach((entry, position) => {
    for (const word of new Set(referenceWords(entry.id + ' ' + (entry.title ?? '') + ' ' + entry.text)))
      (postings[word] ??= []).push(position);
  });
  return postings;
}

// Light query-time normalization. The prebuilt postings stay keyed by raw words; a stem maps
// to every raw word that shares it, so plural/singular and inflected forms match either way.
const stopwords = new Set(['a', 'an', 'the', 'for', 'with', 'and', 'of', 'to', 'in', 'on', 'by']);
const cyrillic = /^[Ѐ-ӿ]+$/u;
const ukrainianSuffixes = [
  'ами',
  'ями',
  'ові',
  'еві',
  'ого',
  'ому',
  'ими',
  'іми',
  'ість',
  'ях',
  'ах',
  'ів',
  'їв',
  'ам',
  'ям',
  'ою',
  'ею',
  'єю',
  'ом',
  'ем',
  'ий',
  'ій',
  'ої',
  'их',
  'іх',
  'а',
  'я',
  'у',
  'ю',
  'і',
  'и',
  'е',
  'є',
  'о',
  'ь',
  'й',
];
export function referenceStem(word: string) {
  if (cyrillic.test(word)) {
    if (word.length < 4) return word;
    for (const suffix of ukrainianSuffixes)
      if (word.endsWith(suffix) && word.length - suffix.length >= 3) return word.slice(0, -suffix.length);
    return word;
  }
  if (word.length < 4 || /\d$/.test(word)) return word;
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('sses')) return word.slice(0, -2);
  if (/(?:x|ch|sh|ss)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !/(?:ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}
/** Raw query words without stopwords; used to locate match windows in original text. */
export const referenceTerms = (text: string) => referenceWords(text).filter((word) => !stopwords.has(word));
export const referenceStems = (text: string) => referenceTerms(text).map(referenceStem);
/** Stemmed, stopword-free text with sentinel spaces for phrase and adjacency checks. */
export const stemmedReference = (text: string) => ' ' + referenceStems(text).join(' ') + ' ';

// Each alias lists alternative stem groups; a group matches when every stem is present.
// Ukrainian aliases map common component vocabulary to the English Oracle corpus.
const aliases: Record<string, string[][]> = {
  textarea: [['text', 'area']],
  textfield: [['text', 'field']],
  textbox: [['text', 'field']],
  datepicker: [['date', 'picker']],
  dropdown: [['select', 'list']],
  combo: [['combobox']],
  toggle: [['switch']],
  graph: [['chart']],
  lov: [['list', 'value']],
  ir: [['interactive', 'report']],
  ig: [['interactive', 'grid']],
  da: [['dynamic', 'action']],
  nav: [['navigation']],
  auth: [['authentication'], ['authorization']],
  javascript: [['java', 'script']],
  plsql: [['pl', 'sql']],
  кнопк: [['button']],
  сторінк: [['page']],
  форм: [['form']],
  діаграм: [['chart']],
  графік: [['chart']],
  звіт: [['report']],
  інтерактивн: [['interactive']],
  картк: [['card']],
  календар: [['calendar']],
  перемикач: [['switch']],
  перевірк: [['validation']],
  валідаці: [['validation']],
  процес: [['process']],
  обчисленн: [['computation']],
  динамічн: [['dynamic']],
  дія: [['action']],
  дії: [['action']],
  авторизаці: [['authorization']],
  автентифікаці: [['authentication']],
  навігаці: [['navigation']],
  меню: [['menu']],
  регіон: [['region']],
  фасетн: [['faceted']],
  пошук: [['search']],
  модальн: [['modal']],
  вікн: [['dialog']],
  діалог: [['dialog']],
  завантаженн: [['upload']],
  файл: [['file']],
  дат: [['date']],
  текст: [['text']],
  пол: [['field']],
  прихован: [['hidden']],
  елемент: [['item']],
  список: [['list']],
  списк: [['list']],
  значенн: [['value']],
  статичн: [['static']],
  вміст: [['content']],
  сітк: [['grid']],
  грід: [['grid']],
  редагуванн: [['edit']],
  редагован: [['editable']],
  вибір: [['select']],
  перехід: [['redirect'], ['branch']],
  гілк: [['branch']],
  оновленн: [['refresh']],
  показник: [['metric']],
  панел: [['dashboard'], ['panel']],
  головн: [['home']],
  вхід: [['login']],
  глобальн: [['global']],
  піктограм: [['icon']],
  іконк: [['icon']],
  заголовок: [['title']],
  колонк: [['column']],
  стовпчик: [['bar']],
  лінійн: [['line']],
  кругов: [['pie']],
  мап: [['map']],
  карт: [['map']],
  секці: [['section']],
  введенн: [['entry'], ['data', 'entry']],
};
export type QueryTerm = { stem: string; alternatives: string[][] };
/** Ordered, de-duplicated query terms with their alias alternatives (at most 16). */
export function referenceQueryTerms(query: string): QueryTerm[] {
  const seen = new Set<string>();
  const terms: QueryTerm[] = [];
  for (const stem of referenceStems(query)) {
    if (seen.has(stem)) continue;
    seen.add(stem);
    terms.push({ stem, alternatives: [[stem], ...(aliases[stem] ?? [])] });
    if (terms.length === 16) break;
  }
  return terms;
}
export const queryPhrase = (terms: QueryTerm[]) => ' ' + terms.map((term) => term.stem).join(' ') + ' ';

const routingPattern =
  /(?:^|[._/])_(?:index|common|shared|template_options|configuration-modules|common_variables)\b|(?:^|\/)README$/;
/** Routing entry points, shared contracts and catalogs: useful for navigation, not generation. */
export const routingReference = (id: string, title: string) =>
  routingPattern.test(id) || routingPattern.test(title);
const navigationalWords = new Set([
  'index',
  'common',
  'readme',
  'routing',
  'contract',
  'contracts',
  'load',
  'order',
]);
export const navigationalQuery = (query: string) =>
  /[:/]/.test(query.trim()) || referenceWords(query).some((word) => navigationalWords.has(word));

export type CodeBlock = { language: string; text: string; truncated: boolean; length: number };
/** The primary fenced block of a Markdown template or recipe, bounded to `limit` characters. */
export function primaryCodeBlock(text: string, limit = 2500): CodeBlock | null {
  const lines = text.split('\n');
  const blocks: { language: string; lines: string[] }[] = [];
  let open: { indent: string; fence: string; language: string; lines: string[] } | undefined;
  for (const line of lines) {
    if (open) {
      const close = line.match(/^(\s*)(`{3,}|~{3,})\s*$/);
      if (
        close &&
        close[1] === open.indent &&
        close[2]![0] === open.fence[0] &&
        close[2]!.length >= open.fence.length
      ) {
        blocks.push({ language: open.language, lines: open.lines });
        open = undefined;
      } else open.lines.push(line.startsWith(open.indent) ? line.slice(open.indent.length) : line);
      continue;
    }
    const start = line.match(/^(\s*)(`{3,}|~{3,})\s*([\w.+-]*)\s*$/);
    if (start) open = { indent: start[1]!, fence: start[2]!, language: start[3]!.toLowerCase(), lines: [] };
  }
  const chosen =
    blocks.find((block) => block.language === 'apexlang') ??
    blocks.find((block) => !block.language) ??
    blocks.sort((a, b) => b.lines.join('\n').length - a.lines.join('\n').length)[0];
  if (!chosen) return null;
  const full = chosen.lines.join('\n');
  if (!full.trim()) return null;
  return boundCode({ language: chosen.language, text: full, truncated: false, length: full.length }, limit);
}
/** Cut a code block at a line boundary so the returned text stays syntactically readable. */
export function boundCode(code: CodeBlock, limit: number): CodeBlock {
  if (code.text.length <= limit) return code;
  const cut = code.text.lastIndexOf('\n', limit);
  return { ...code, text: code.text.slice(0, cut > limit / 2 ? cut : limit), truncated: true };
}

/** Code is attached to every hit, to the first hit of the first page, or to none. */
export function codeWanted(include: 'code' | 'metadata' | undefined, offset: number, position: number) {
  return include === 'code' || (include !== 'metadata' && offset === 0 && position === 0);
}
export const CODE_LIMIT = 2500;
export const SEARCH_LINKS = 3;
type Shrinkable = { text: string; code?: CodeBlock | null; [key: string]: unknown };
/**
 * Fit a result page into its character budget: shorten later snippets first, then the
 * inline code, then every snippet, and drop resolved links before dropping code.
 */
export function fitResults<T extends Shrinkable>(results: T[], budget: number, size: (page: T[]) => number) {
  const halve = (hit: Shrinkable, floor: number) => {
    const next = Math.floor(hit.text.length / 2);
    if (hit.text.length <= floor) return false;
    hit.text = hit.text.slice(0, Math.max(floor, next));
    return true;
  };
  const shrinkCode = (hit: Shrinkable, floor: number) => {
    if (!hit.code || hit.code.text.length <= floor) return false;
    hit.code = boundCode(hit.code, Math.max(floor, Math.floor(hit.code.text.length / 2)));
    return true;
  };
  while (size(results) > budget) {
    if (results.slice(1).some((hit) => halve(hit, 300))) continue;
    if (results.some((hit) => shrinkCode(hit, 600))) continue;
    if (results.slice(1).some((hit) => 'relatedReferences' in hit && delete hit.relatedReferences)) continue;
    if (results.slice(1).some((hit) => 'requiresReferences' in hit && delete hit.requiresReferences))
      continue;
    if (results.some((hit) => halve(hit, 100))) continue;
    if (results.some((hit) => hit.code && delete hit.code)) continue;
    break;
  }
  return results;
}
/** Identifier-like queries (camelCase, hyphenated or prefixed names) look for a production or parameter. */
export const identifierQuery = (query: string) =>
  /^[A-Za-z][\w.:/-]*$/.test(query.trim()) && /[a-z][A-Z]|[-_.:/]/.test(query.trim());
const canonicalPattern = /[._/](?:standard|basic|minimal|example|default)(?:-[a-z-]+)?$|\/recipes\/basic$/;
/** The default scenario of a family: the first template to adapt when the query names only the family. */
export const canonicalReference = (id: string) => canonicalPattern.test(id);
const lengthPenalty = (length: number) => Math.min(150, Math.max(0, Math.log2(length / 2000)) * 25);
export type ScoreInput = {
  terms: QueryTerm[];
  phrase: string;
  navigational: boolean;
  exact: boolean;
  /** Query terms present anywhere in the document (ID, title or body). */
  matched: number;
  titleText: string;
  titleStems: Set<string>;
  /** Weight of an exact or leading title match; lowered for grammar productions in prose queries. */
  titleWeight: number;
  /** Stemmed body text; invoked lazily and only for the candidates that reach the final pass. */
  bodyText?: (() => string) | undefined;
  quoted?: boolean | undefined;
  prior: number;
  routing: boolean;
  canonical: boolean;
  length: number;
};
/**
 * Any-term scoring with a strong preference for documents that match every term, the
 * title, the exact phrase and adjacent terms. Returns null when too little matches.
 */
export function scoreReference(input: ScoreInput): number | null {
  const { terms, matched } = input;
  // Any-term fallback still needs at least half of the terms; a lone incidental word is noise.
  if (matched * 2 < terms.length && !input.exact) return null;
  let titleHits = 0;
  let titleOrder = 0;
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i]!;
    let hit = false;
    for (const alternative of term.alternatives) {
      hit = true;
      for (const stem of alternative) if (!input.titleStems.has(stem)) hit = false;
      if (hit) break;
    }
    if (hit) {
      titleHits++;
      titleOrder += 50 + 10 * (terms.length - i);
    }
  }
  const coverage = matched / terms.length;
  let score =
    (input.exact ? 10000 : 0) +
    (input.titleText === input.phrase || input.titleText.startsWith(input.phrase) ? input.titleWeight : 0) +
    (input.titleText.includes(input.phrase) ? 400 : 0) +
    titleOrder +
    (titleHits === terms.length ? 200 : 0) +
    300 * coverage * coverage +
    (input.quoted ? 150 : 0) +
    input.prior +
    // Routing documents sink below concrete templates unless the query asks for them.
    (input.routing ? (input.navigational ? 150 : -250) : 0) +
    (input.canonical && !input.navigational ? 60 : 0) -
    lengthPenalty(input.length) +
    1 / (1 + input.length / 1000);
  if (input.bodyText && terms.length) {
    const body = input.bodyText();
    if (body.includes(input.phrase)) score += 40;
    for (let i = 1; i < terms.length; i++)
      if (body.includes(' ' + terms[i - 1]!.stem + ' ' + terms[i]!.stem + ' ')) score += 60;
  }
  return score;
}
