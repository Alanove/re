/**
 * Arabic-aware text folding for search. Indexing and querying both run through `normalizeForSearch`,
 * so "الصلاه", "الصّلاة" and "الصلاة" all reach the same token.
 */

// Tashkeel (harakat, shadda, sukun, tanwin), Quranic marks and the superscript alef.
const DIACRITICS = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06dc\u06df-\u06e8\u06ea-\u06ed]/g;
const TATWEEL = /\u0640/g;
const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g;
const EXTENDED_DIGITS = /[\u06f0-\u06f9]/g;
const LATIN_MARKS = /[\u0300-\u036f]/g;

const LETTER_FOLDS: [RegExp, string][] = [
  [/[\u0622\u0623\u0625\u0671\u0672\u0673]/g, '\u0627'], // آ أ إ ٱ -> ا
  [/\u0649/g, '\u064a'], // ى -> ي
  [/\u0629/g, '\u0647'], // ة -> ه
  [/\u0624/g, '\u0648'], // ؤ -> و
  [/\u0626/g, '\u064a'], // ئ -> ي
  [/\u06cc/g, '\u064a'], // Persian ی -> ي
  [/\u06a9/g, '\u0643'] // Persian ک -> ك
];

const ARABIC_LETTER = /[\u0621-\u064a\u0671-\u06d3]/;
const ARABIC_LETTERS_GLOBAL = /[\u0621-\u064a\u0671-\u06d3]/g;
const LATIN_LETTERS_GLOBAL = /[A-Za-z\u00c0-\u024f]/g;

/** Folds one string: strips marks and tatweel, unifies letter variants and digits, lowercases Latin. */
export function normalizeForSearch(value: string): string {
  let text = value.normalize('NFKD').replace(LATIN_MARKS, '').normalize('NFC');
  text = text.replace(DIACRITICS, '').replace(TATWEEL, '');
  for (const [pattern, replacement] of LETTER_FOLDS) {
    text = text.replace(pattern, replacement);
  }
  text = text
    .replace(ARABIC_INDIC_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(EXTENDED_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x06f0));
  return text.toLowerCase();
}

/** Splits text into search terms (letters and digits of any script). */
export function tokenize(value: string): string[] {
  return value.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

const DEFINITE_PREFIXES = ['وال', 'بال', 'كال', 'فال', 'لل', 'ال'];
const TERM_CACHE_LIMIT = 200_000;
const termCache = new Map<string, string[]>();

/**
 * Index-time term processing: folds the term and, for Arabic words carrying the article "ال" (or a
 * conjunction plus "ال"), also emits the bare stem so "كنيسة" finds "الكنيسة".
 * Results are memoised per distinct word, since the same words repeat across thousands of articles.
 */
export function expandTerm(term: string): string[] {
  const cached = termCache.get(term);
  if (cached) {
    return cached;
  }
  if (termCache.size >= TERM_CACHE_LIMIT) {
    termCache.clear();
  }
  const terms = foldTerm(term);
  termCache.set(term, terms);
  return terms;
}

function foldTerm(term: string): string[] {
  const folded = normalizeForSearch(term);
  if (folded.length < 2) {
    return /\d/.test(folded) ? [folded] : [];
  }
  const terms = [folded];
  if (ARABIC_LETTER.test(folded)) {
    const prefix = DEFINITE_PREFIXES.find((candidate) => folded.startsWith(candidate) && folded.length - candidate.length >= 2);
    if (prefix) {
      terms.push(folded.slice(prefix.length));
    }
  }
  return terms;
}

/** Query-time term processing: fold and drop the article so "الكنيسه" and "كنيسة" match the same stems. */
export function queryTerm(term: string): string | null {
  const folded = normalizeForSearch(term);
  if (folded.length < 2 && !/\d/.test(folded)) {
    return null;
  }
  if (ARABIC_LETTER.test(folded)) {
    const prefix = DEFINITE_PREFIXES.find((candidate) => folded.startsWith(candidate) && folded.length - candidate.length >= 2);
    if (prefix) {
      return folded.slice(prefix.length);
    }
  }
  return folded;
}

/** Share of letters that are Arabic (0 to 1); text without letters counts as Arabic. */
export function arabicShare(text: string): number {
  const arabic = text.match(ARABIC_LETTERS_GLOBAL)?.length ?? 0;
  const latin = text.match(LATIN_LETTERS_GLOBAL)?.length ?? 0;
  return arabic + latin === 0 ? 1 : arabic / (arabic + latin);
}

/** Pages are right-to-left unless fewer than 40% of their letters are Arabic. */
export function detectDirection(text: string): 'rtl' | 'ltr' {
  return arabicShare(text) < 0.4 ? 'ltr' : 'rtl';
}

/**
 * Legacy content forces `dir="rtl"` on every block, even in French articles. Blocks marked against the
 * document's direction fall back to `dir="auto"`, so each one follows its own text.
 */
export function relaxOpposingDirections(html: string, direction: 'rtl' | 'ltr'): string {
  const opposing = direction === 'ltr' ? 'rtl' : 'ltr';
  return html.replace(new RegExp(String.raw`\sdir=(["']?)${opposing}\1(?=[\s>/])`, 'gi'), ' dir="auto"');
}

/** Guesses the `lang` of a left-to-right text: French when it carries French accents or words, otherwise English. */
export function guessLatinLanguage(text: string): 'fr' | 'en' {
  const sample = text.slice(0, 4000).toLowerCase();
  const french = (sample.match(/[éèêàçùâîôœ]|\b(le|la|les|des|du|une|et|est|dans|pour|avec|qui)\b/g) ?? []).length;
  const english = (sample.match(/\b(the|and|of|is|in|for|with|that|this)\b/g) ?? []).length;
  return french >= english ? 'fr' : 'en';
}

/** Turns a title into a URL slug, keeping Arabic letters (marks removed) and lowercasing Latin. */
export function slugifyArabic(value: string): string {
  return value
    .normalize('NFKD')
    .replace(LATIN_MARKS, '')
    .normalize('NFC')
    .replace(DIACRITICS, '')
    .replace(TATWEEL, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
    .replace(/-+$/g, '');
}
