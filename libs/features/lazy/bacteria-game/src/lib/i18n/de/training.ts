import type { training as en } from '../en/training';
import type { Translation } from '../translation';

export const training: Translation<typeof en> = {
  title: 'Training',
  pick: 'Fünf kurze Missionen, die dir das Spiel beibringen – eins nach dem anderen.',
  progress: '{done} von {total} Missionen geschafft',
  done: 'Geschafft',
  upNext: 'Als Nächstes',
  kicker: 'Mission {number} von {total}',
  goalLabel: 'Ziel',
  tipLabel: 'Tipp',
  missions: {
    steer: {
      title: 'Steuern',
      description:
        'Deine Kolonie folgt deinem Fadenkreuz. Steuere sie auf die weiße Zone in der Mitte und bleib dort.',
      goal: 'Halte die weiße Zone 4 Sekunden lang',
      tip: 'Zieh auf der Arena, oder nimm WASD, die Pfeiltasten oder den Stick.',
    },
    feed: {
      title: 'Fressen',
      description:
        'Nährstoffe füttern, wer auf ihnen steht, und gut genährte Bakterien teilen sich. Friss acht davon.',
      goal: 'Friss 8 Nährstoffe',
      tip: 'Steuere auf die leuchtenden Nährstoffe – ein Nährstoff gehört der Kolonie, die am meisten davon gefressen hat.',
    },
    boost: {
      title: 'Boost',
      description:
        'Der Boost macht deine Kolonie kurz schneller und angriffslustiger, dann lädt er nach – hier schnell. Booste auf dem Weg zu zwölf Nährstoffen.',
      goal: 'Friss 12 Nährstoffe und booste zweimal',
      tip: 'Leertaste, oder das Boost-Feld auf dem Touchscreen.',
    },
    attack: {
      title: 'Angriff',
      description:
        'Der Angreifer ist im Vorteil: Dräng in die Attrappe, schnapp dir ihre Bakterien und lösch sie aus.',
      goal: 'Lösche die Attrappe aus',
      tip: 'Steuere direkt hinein und booste beim Aufprall.',
    },
    fight: {
      title: 'Erster Kampf',
      description:
        'Der leichte Computer wehrt sich. Erst fressen, angreifen, sobald du größer bist, und nach einer Minute die größere Kolonie sein – oder seine auslöschen.',
      goal: 'Sei nach einer Minute größer als der Computer',
      tip: 'Erst fressen, angreifen, wenn du größer bist, mit dem Boost durchbrechen.',
    },
  },
  opponents: {
    dummy:
      'Eine Trainingsattrappe – sie bleibt stehen und wehrt sich nur, wo du sie angreifst.',
    computer: 'Der leichte Computer – reagiert langsam und boostet nie.',
  },
  result: {
    first: 'Mission geschafft!',
    again: 'Mission wieder geschafft',
    notYet: 'Noch nicht – {goal}',
    boosts: {
      one: 'booste unterwegs mindestens einmal, du hast {fired}-mal geboostet',
      other: 'booste unterwegs {count}-mal, du hast {fired}-mal geboostet',
    },
    allDone: 'Training geschafft – die Kampagne wartet.',
  },
  actions: {
    next: 'Nächste Mission',
    all: 'Alle Missionen',
    campaign: 'Zur Kampagne',
  },
  menu: {
    title: 'Training',
    note: 'Neu hier? {done} von {total} Missionen geschafft',
  },
};
