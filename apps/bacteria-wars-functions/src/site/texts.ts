import {
  type EndReason,
  getLevel,
  isLadderLevel,
  parseGeneratedId,
  type ReplayReason,
} from '@wolsok/feat-lazy-bac-game/engine';

/**
 * The words of the public replay pages (ADR 0011), English and German: a
 * small dictionary of the server's own - the game's I18nService is
 * Angular's. The ladder's English titles come from the engine's levels;
 * the German ones are the game's (`i18n/de/levels.ts`), which a spec keeps
 * complete.
 */
export type Lang = 'en' | 'de';

/** The German titles of the ladder's levels, by id. */
export const DE_TITLES: Readonly<Record<string, string>> = {
  'petri-dish': 'Petrischale',
  corridors: 'Korridore',
  hourglass: 'Sanduhr',
  'inner-ring': 'Innerer Ring',
  'pillar-field': 'Säulenfeld',
  'twin-chambers': 'Zwillingskammern',
  serpentine: 'Serpentine',
  pistons: 'Kolben',
  alveoli: 'Alveolen',
  mycelium: 'Myzel',
  heartbeat: 'Herzschlag',
  villi: 'Zotten',
  'half-life': 'Halbwertszeit',
  containment: 'Eindämmung',
  'control-room': 'Kontrollraum',
  meltdown: 'Kernschmelze',
  'patient-zero': 'Patient null',
  quarantine: 'Quarantäne',
  'feeding-ground': 'Futterplatz',
  expanse: 'Weite',
  archipelago: 'Archipel',
  bloodstream: 'Blutbahn',
  'root-network': 'Wurzelnetz',
  leviathan: 'Leviathan',
};

const WORDS = {
  en: {
    site: 'Bacteria Wars',
    gallery: 'Matches of the day',
    galleryIntro:
      'The best matches of Bacteria Wars, picked each day from the matches players saved and checked by the server.',
    empty: 'No match has been picked yet.',
    matchOfTheDay: 'Match of the day',
    description: 'A match of the day of Bacteria Wars on {level}: {result}.',
    computer: 'the computer',
    colony: '{color} colony',
    won: '{player} won',
    draw: 'Draw',
    vs: 'vs',
    length: 'Length',
    ending: 'Ended by',
    score: 'Score',
    older: 'Older matches',
    play: 'Play Bacteria Wars',
    back: 'All matches of the day',
    watch: 'Watch the match',
    notFound: 'Not found.',
    removed: 'This match is no longer public.',
    daily: 'Daily level',
    endless: 'Endless',
    generated: 'Generated level',
    timeline: 'Colony sizes over the match',
    language: 'Deutsch',
  },
  de: {
    site: 'Bacteria Wars',
    gallery: 'Matches des Tages',
    galleryIntro:
      'Die besten Matches von Bacteria Wars, jeden Tag aus den gespeicherten Matches ausgewählt und vom Server geprüft.',
    empty: 'Noch wurde kein Match ausgewählt.',
    matchOfTheDay: 'Match des Tages',
    description: 'Ein Match des Tages von Bacteria Wars auf {level}: {result}.',
    computer: 'der Computer',
    colony: 'Kolonie {color}',
    won: '{player} gewinnt',
    draw: 'Unentschieden',
    vs: 'gegen',
    length: 'Dauer',
    ending: 'Beendet durch',
    score: 'Wertung',
    older: 'Ältere Matches',
    play: 'Bacteria Wars spielen',
    back: 'Alle Matches des Tages',
    watch: 'Match ansehen',
    notFound: 'Nicht gefunden.',
    removed: 'Dieses Match ist nicht mehr öffentlich.',
    daily: 'Tageslevel',
    endless: 'Endlos',
    generated: 'Generiertes Level',
    timeline: 'Koloniegrößen im Verlauf',
    language: 'English',
  },
} as const;

export type Word = keyof (typeof WORDS)['en'];

/** A word of the pages, with `{name}` placeholders filled in. */
export function t(
  lang: Lang,
  word: Word,
  params: Readonly<Record<string, string>> = {}
): string {
  return WORDS[lang][word].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(params[name] ?? '')
  );
}

const COLORS: Record<Lang, Record<string, string>> = {
  en: {
    orange: 'Orange',
    blue: 'Blue',
    green: 'Green',
    pink: 'Pink',
    purple: 'Purple',
    yellow: 'Yellow',
    cyan: 'Cyan',
    red: 'Red',
  },
  de: {
    orange: 'Orange',
    blue: 'Blau',
    green: 'Grün',
    pink: 'Pink',
    purple: 'Lila',
    yellow: 'Gelb',
    cyan: 'Cyan',
    red: 'Rot',
  },
};

/** A colour's name, its id where none is known. */
export function colorName(lang: Lang, colorId: string): string {
  return COLORS[lang][colorId] ?? colorId;
}

/** The colour ids the dictionary names - for its spec. */
export const COLOR_IDS = Object.keys(COLORS.en);

// Typed by the engine's lists, so a new ending or reason needs its words.
const ENDINGS: Record<Lang, Record<EndReason, string>> = {
  en: {
    annihilation: 'annihilation',
    time: 'time',
    hold: 'holding the zone',
    survive: 'surviving',
    harvest: 'harvest',
    forfeit: 'the other player leaving',
    desync: 'a desync',
  },
  de: {
    annihilation: 'Auslöschung',
    time: 'Zeitablauf',
    hold: 'Halten der Zone',
    survive: 'Überleben',
    harvest: 'Ernte',
    forfeit: 'Aufgabe des Gegners',
    desync: 'Asynchronität',
  },
};

/** How a match ended, in words. */
export function endingName(lang: Lang, endedBy: string): string {
  return ENDINGS[lang][endedBy as EndReason] ?? endedBy;
}

const REASONS: Record<Lang, Record<ReplayReason, string>> = {
  en: {
    close: 'Close',
    comeback: 'Comeback',
    'lead-changes': 'Lead changes',
    length: 'Good length',
    feat: 'Feat',
    online: 'Online',
  },
  de: {
    close: 'Knapp',
    comeback: 'Comeback',
    'lead-changes': 'Führungswechsel',
    length: 'Gute Länge',
    feat: 'Glanzleistung',
    online: 'Online',
  },
};

/** A score reason's badge text. */
export function reasonName(lang: Lang, reason: string): string {
  return REASONS[lang][reason as ReplayReason] ?? reason;
}

/**
 * A level's name: a ladder level's title, a generated level by its kind,
 * recipe and difficulty.
 */
export function levelName(lang: Lang, levelId: string, kind: string): string {
  const generated = parseGeneratedId(levelId);
  if (generated !== null) {
    const what =
      kind === 'daily'
        ? t(lang, 'daily')
        : kind === 'endless'
          ? t(lang, 'endless')
          : t(lang, 'generated');
    return `${what} · ${generated.recipe} ${generated.difficulty}`;
  }
  if (!isLadderLevel(levelId)) {
    return levelId;
  }
  return lang === 'de'
    ? (DE_TITLES[levelId] ?? levelId)
    : getLevel(levelId).name.replace(/^\d+ · /, '');
}
