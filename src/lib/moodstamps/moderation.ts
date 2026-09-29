import {
  ALLOWED_PHRASES,
  FRAGMENTS,
  PHRASES,
  ROOTS,
  TARGETED_INSULTS,
  VOCATIVE_INSULTS,
  WORDS,
  type ModerationCategory,
} from './moderation-terms';

export type { ModerationCategory } from './moderation-terms';

/**
 * Checks MoodStamp text for language it cannot carry.
 *
 * Runs unchanged in the browser, as the sender types, and on the server,
 * where it is the check that counts: a request that skips the form meets the
 * same rules.
 *
 * Everything is first reduced to one comparable form — lowercase, no accents,
 * leetspeak read back as letters ("sh1t", "@ss"), punctuation inside a word
 * dropped ("f.u.c.k"), letters typed apart joined up ("f u c k"). Masked words
 * ("f*ck", "b***h") are matched against the list with each mask standing for
 * one letter; stretched ones ("fuuuck") with their repeats collapsed.
 *
 * Words are matched whole, never as a substring of a longer word, which is how
 * "class", "assess", "cocktail" and "grape" stay clean. The few exceptions
 * are the fragments list — terms distinctive enough to look for in text with
 * the spaces taken out.
 */

export interface ModerationHit {
  /** The listed term that matched, in its plain form. */
  term: string;
  category: ModerationCategory;
}

export interface ModerationResult {
  clean: boolean;
  hits: ModerationHit[];
}

const CATEGORIES = Object.keys(WORDS) as ModerationCategory[];

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
  $: 's',
  '!': 'i',
  '|': 'i',
  '+': 't',
  '€': 'e',
};

const MASK = /[*#]/;

/** Every run of a repeated letter down to one: "fuuuck" → "fuck". Applied to both sides of a comparison. */
function collapse(word: string): string {
  return word.replace(/(.)\1+/g, '$1');
}

interface Lexicon {
  words: Map<string, ModerationCategory>;
  collapsedWords: Map<string, ModerationCategory>;
  roots: Array<[string, ModerationCategory]>;
  fragments: Array<[string, ModerationCategory]>;
  phrases: Array<[string, ModerationCategory]>;
  targeted: Set<string>;
  vocative: Set<string>;
}

let lexicon: Lexicon | null = null;

function getLexicon(): Lexicon {
  if (lexicon) return lexicon;

  const words = new Map<string, ModerationCategory>();
  const collapsedWords = new Map<string, ModerationCategory>();
  const roots: Array<[string, ModerationCategory]> = [];
  const fragments: Array<[string, ModerationCategory]> = [];
  const phrases: Array<[string, ModerationCategory]> = [];

  for (const category of CATEGORIES) {
    for (const word of WORDS[category]) {
      const plain = word.replace(/[^a-z]/g, '');
      words.set(plain, category);
      collapsedWords.set(collapse(plain), category);
    }
    for (const root of ROOTS[category]) roots.push([root, category]);
    for (const fragment of FRAGMENTS[category]) fragments.push([fragment, category]);
    for (const phrase of PHRASES[category]) phrases.push([normalise(phrase).join(' '), category]);
  }

  lexicon = {
    words,
    collapsedWords,
    roots,
    fragments,
    phrases,
    targeted: new Set(TARGETED_INSULTS),
    vocative: new Set(VOCATIVE_INSULTS),
  };
  return lexicon;
}

/**
 * Text as a list of comparable words.
 *
 * Masks survive as `*` so they can be matched later; every other symbol inside
 * a word is either read as the letter it stands for or dropped.
 */
function normalise(text: string): string[] {
  const plain = text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’‘`´']/g, '');

  const words: string[] = [];
  for (const raw of plain.split(/\s+/)) {
    // Sentence punctuation around a word is not part of it; masks and leet symbols can be.
    const trimmed = raw.replace(/^[^\p{L}\p{N}*#@$]+|[^\p{L}\p{N}*#@$]+$/gu, '');
    if (!trimmed) continue;

    // Only read digits and symbols as letters inside something that has letters —
    // "45" is a count, "4ss" is not.
    const hasLetter = /\p{L}/u.test(trimmed);
    let word = '';
    for (const char of trimmed) {
      if (/\p{L}/u.test(char)) word += char;
      else if (char === '*' || char === '#') word += '*';
      else if (hasLetter && LEET[char]) word += LEET[char];
      // anything else — dots, dashes, underscores — is dropped
    }
    word = word.replace(/[^a-z*]/g, '');
    if (word) words.push(word);
  }

  // Letters typed one at a time — "f u c k" — join into the word they spell.
  const joined: string[] = [];
  let run = '';
  for (const word of words) {
    if (word.length === 1 && word !== '*') {
      run += word;
      continue;
    }
    if (run) {
      joined.push(run);
      run = '';
    }
    joined.push(word);
  }
  if (run) joined.push(run);

  return joined;
}

function matchWord(word: string, lex: Lexicon): ModerationHit | null {
  const exact = lex.words.get(word);
  if (exact) return { term: word, category: exact };

  for (const [root, category] of lex.roots) {
    if (word.startsWith(root)) return { term: root, category };
  }

  // Stretched for emphasis or to slip past: "fuuuck", "shiiit", "idiooot".
  if (/(.)\1\1/.test(word)) {
    const collapsed = collapse(word);
    const hit = lex.collapsedWords.get(collapsed);
    if (hit) {
      const term = [...lex.words.keys()].find((candidate) => collapse(candidate) === collapsed) ?? collapsed;
      return { term, category: hit };
    }
    for (const [root, category] of lex.roots) {
      if (collapsed.startsWith(collapse(root))) return { term: root, category };
    }
  }

  // Masked: "f*ck", "sh**", "b***h". Each mask stands for one letter.
  if (MASK.test(word)) {
    const letters = word.replace(/\*/g, '').length;
    if (letters >= 1 && word.length >= 3) {
      const pattern = new RegExp(`^${word.replace(/\*/g, '[a-z]')}$`);
      for (const [candidate, category] of lex.words) {
        if (pattern.test(candidate)) return { term: candidate, category };
      }
      for (const [root, category] of lex.roots) {
        if (new RegExp(`^${word.replace(/\*/g, '[a-z]')}`).test(root)) return { term: root, category };
      }
    }
  }

  return null;
}

const COPULA = /(?:^| )(?:you are|you re|you r|youre|ur|u are|you were|you look|you seem|you sound|you act|you are being|youre being|you were being)((?: (?:such|so|a|an|the|really|very|totally|completely|absolutely|absolute|complete|utter|just|one|big|little|such a|being|always|literally))*) ([a-z]+)/g;

/** "You're useless", "you are such a joke", "you clown". */
function findTargetedInsults(sentence: string, lex: Lexicon): ModerationHit[] {
  const hits: ModerationHit[] = [];

  for (const match of sentence.matchAll(COPULA)) {
    const word = match[2];
    if (lex.targeted.has(word)) hits.push({ term: `you're ${word}`, category: 'insult' });
  }

  for (const match of sentence.matchAll(/(?:^| )(?:you|u) ([a-z]+)/g)) {
    if (lex.vocative.has(match[1])) hits.push({ term: `you ${match[1]}`, category: 'insult' });
  }

  return hits;
}

export function moderateText(text: string): ModerationResult {
  if (!text || !text.trim()) return { clean: true, hits: [] };

  const lex = getLexicon();
  let sentence = ` ${normalise(text).join(' ')} `;

  for (const allowed of ALLOWED_PHRASES) {
    const phrase = ` ${normalise(allowed).join(' ')} `;
    while (sentence.includes(phrase)) sentence = sentence.replace(phrase, ' ');
  }

  const hits: ModerationHit[] = [];
  const words = sentence.trim().split(' ').filter(Boolean);

  for (const word of words) {
    const hit = matchWord(word, lex);
    if (hit) hits.push(hit);
  }

  for (const [phrase, category] of lex.phrases) {
    if (sentence.includes(` ${phrase} `)) hits.push({ term: phrase, category });
  }

  hits.push(...findTargetedInsults(sentence.trim(), lex));

  // Spaces stripped out: "fu ck", "go fuckyourself".
  const compact = words.join('').replace(/\*/g, '');
  for (const [fragment, category] of lex.fragments) {
    if (compact.includes(fragment)) hits.push({ term: fragment, category });
  }

  // One entry per term, keeping the first — and the most specific — reason.
  const seen = new Set<string>();
  const unique: ModerationHit[] = [];
  for (const hit of hits) {
    if (seen.has(hit.term)) continue;
    if (unique.some((kept) => kept.term.includes(hit.term) || hit.term.includes(kept.term))) continue;
    seen.add(hit.term);
    unique.push(hit);
  }

  return { clean: unique.length === 0, hits: unique };
}

const CATEGORY_LABELS: Record<ModerationCategory, string> = {
  profanity: 'swearing',
  sexual: 'sexual or 18+ content',
  hate: 'a slur',
  insult: 'a personal insult',
  threat: 'a threat or a wish for harm',
};

export function categoryLabel(category: ModerationCategory): string {
  return CATEGORY_LABELS[category];
}

/**
 * How a caught term is shown back to the sender. Swearing, sexual terms and
 * slurs are masked — the sender knows what they typed, and nobody else
 * looking at the screen needs it repeated large. Insults and threats are
 * ordinary words and are shown as they are, so the sender can find them.
 */
export function displayTerm(hit: ModerationHit): string {
  if (hit.category === 'insult' || hit.category === 'threat') return hit.term;
  if (hit.term.length <= 2) return hit.term[0] + '•';
  return hit.term[0] + '•'.repeat(hit.term.length - 1);
}

/** One sentence for a field that failed: what was found, and what to do instead. */
export function moderationMessage(result: ModerationResult): string | null {
  if (result.clean) return null;
  const first = result.hits[0];
  const more = result.hits.length > 1 ? ` and ${result.hits.length - 1} more` : '';
  const advice =
    first.category === 'insult'
      ? 'Describe what happened, not what they are.'
      : first.category === 'threat'
        ? 'MoodStamps can be critical, never threatening.'
        : 'Say it in words you would say to their face at work.';
  return `“${displayTerm(first)}”${more} reads as ${categoryLabel(first.category)}. ${advice}`;
}
