import type { newGame as en } from '../en/new-game';
import type { Translation } from '../translation';

export const newGame: Translation<typeof en> = {
  title: 'Neues Spiel',
  steps: {
    mode: 'Modus',
    level: 'Level',
    start: 'Start',
  },
  modes: {
    campaign: {
      name: 'Kampagne',
      blurb:
        'Level für Level die Leiter hinauf – jeder Sieg öffnet das nächste.',
    },
    daily: {
      name: 'Tageslevel',
      blurb: 'Jeden Tag ein generiertes Level, für alle dasselbe.',
    },
    endless: {
      name: 'Endlos-Lauf',
      blurb: 'Generierte Levels, eins nach dem anderen – wie weit kommst du?',
    },
    free: {
      name: 'Freies Spiel',
      blurb: 'Alle Levels offen, dazu neue aus dem Generator.',
    },
    'two-players': {
      name: 'Zwei Spieler',
      blurb: 'Ein Bildschirm, zwei Kolonien – eine Serie unter Freunden.',
    },
    online: {
      name: 'Online',
      blurb: 'Zwei Geräte, ein Match – teil einen Code mit einem Freund.',
    },
  },
  notes: {
    campaign: '{open} von {total} Levels offen',
    attemptsLeft: '{left} von {total} Versuchen übrig',
    attemptsUsed: 'Versuche verbraucht – Training bis 00:00 UTC',
    streak: {
      one: '{attempts} · {count} Tag in Folge',
      other: '{attempts} · {count} Tage in Folge',
    },
    endless: 'Generierte Levels, mit jedem Sieg schwerer – drei Leben',
    endlessBest: 'Generierte Levels, mit jedem Sieg schwerer · Bestwert {best}',
    free: 'Jede Schwierigkeit, jedes Level',
    online: 'Ein Freund an einem anderen Gerät',
    offline: 'Nicht in dieser Version',
  },
  next: 'Weiter',
  briefing: 'Briefing',
  generatedKicker: '{style} · Schwierigkeit {difficulty}',
  endless: {
    kicker: 'Endlos-Lauf',
    title: 'So weit du kommst',
    description: {
      one: 'Generierte Levels, eins nach dem anderen, jeder Sieg eine Stufe schwerer. Eine Niederlage kostet dein einziges Leben.',
      other:
        'Generierte Levels, eins nach dem anderen, jeder Sieg eine Stufe schwerer. Eine Niederlage kostet eins von {count} Leben.',
    },
  },
  opponent: 'Gegner',
  /** What the computer evolved on this level and difficulty (ADR 0014). */
  enemy: {
    evolved: 'Der Gegner hat sich entwickelt: {list}',
    plain: 'Der Gegner hat sich noch nicht entwickelt.',
    /** A gene and its level in the list: "Venom Glands 3". */
    gene: '{name} {level}',
  },
  difficulty: 'Schwierigkeit',
  yourBest: 'Dein Bestwert auf {difficulty}',
  allMedals: 'Alle Medaillen dieses Levels gehören dir.',
  headStart: {
    label: 'Vorsprung',
    even: 'Ausgeglichen',
    ahead: '{name} {steps}',
    note: 'Die andere Kolonie startet kleiner – eine Stufe pro +.',
  },
  score: '{left} {leftWins} : {rightWins} {right}',
  start: {
    run: 'Lauf starten',
    daily: 'Tageslevel starten',
    level: '{title} starten',
  },
  levelMap: {
    open: '{open} von {total} offen',
    generated: {
      title: 'Generiert',
      blurb: 'Levels aus einem Seed – jedes Mal neu.',
      label: 'Generierte Levels',
      generateTitle: 'Level generieren',
      style: 'Stil',
      anyStyle: 'Beliebig',
      difficulty: 'Schwierigkeit {difficulty}',
      difficultyLabel: 'Schwierigkeit des generierten Levels',
      generate: 'Generieren',
    },
    /** Das Vorschaubild eines Levels. */
    preview: {
      alt: 'Karte von {title}',
      size: '{size}× Karte',
      sizeLabel: 'Eine Karte, {size}-mal so groß wie der Bildschirm',
    },
  },
};
