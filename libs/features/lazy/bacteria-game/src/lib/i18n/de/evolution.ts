import type { evolution as en } from '../en/evolution';
import type { Translation } from '../translation';

export const evolution: Translation<typeof en> = {
  title: 'Evolution',
  tagline: 'Gib DNA aus. Züchte eine fiesere Kolonie.',
  plays:
    'Evolution zählt gegen den Computer in der Kampagne und auf generierten Levels, dort auch gegen deinen Geist, der mit dem spielt, was sein Lauf hatte. Das Tageslevel, Endlos-Läufe, Duelle am Gerät und Online-Matches bleiben ohne, fair für alle.',
  dna: {
    label: 'DNA',
    available: '{count} DNA zum Ausgeben',
    earned: '{count} DNA insgesamt verdient',
    how: 'Alle 50 XP wächst ein Strang.',
    loading: 'Deine DNA wird gelesen…',
  },
  genes: {
    title: 'Gene',
    level: 'Stufe {level} von {max}',
    none: 'Noch nicht gezüchtet',
    next: 'Nächste: {effect}',
    maxed: 'Voll entwickelt',
    buy: 'Entwickeln',
    buyLabel: '{name} für {cost} DNA auf Stufe {level} entwickeln',
    pips: '{name}: Stufe {level} von {max}',
    names: {
      mitosis: 'Teilungsturbo',
      toxins: 'Giftdrüsen',
      membrane: 'Eisenmembran',
      flagella: 'Turbogeißeln',
      metabolism: 'Hyperstoffwechsel',
    },
    descriptions: {
      mitosis: 'Deine Bakterien teilen sich schneller – mehr davon, früher.',
      toxins: 'Jeder Biss deiner Bakterien tut mehr weh.',
      membrane: 'Dickere Haut: Deine Bakterien nehmen weniger Schaden.',
      flagella: 'Peitschende Schwänze: Deine Bakterien flitzen davon.',
      metabolism: 'Brennt heißer: Dein Boost lädt schneller auf.',
    },
    effects: {
      mitosis: '+{percent} % Teilung',
      toxins: '+{percent} % Biss',
      membrane: '−{percent} % Schaden',
      flagella: '+{percent} % Tempo',
      metabolism: '−{percent} % Boost-Ladezeit',
    },
  },
  weapons: {
    title: 'Waffen',
    where:
      'Nimm eine mit ins Match und feuere sie mit der Taste neben dem Boost.',
    buy: 'Kaufen',
    buyLabel: '{name} für {cost} DNA kaufen',
    equip: 'Ausrüsten',
    equipped: 'Ausgerüstet',
    equipLabel: '{name} in Matches mitnehmen',
    cooldown: '{seconds} s Ladezeit',
    radius: 'Radius {radius}',
    duration: '{seconds} s',
    instant: 'Sofort',
    names: {
      'toxin-bomb': 'Giftbombe',
      'cryo-pulse': 'Kryo-Puls',
      'phage-strike': 'Phagen-Schlag',
      'agar-bloom': 'Agar-Blüte',
      'biofilm-shield': 'Biofilm-Schild',
    },
    descriptions: {
      'toxin-bomb':
        'Eine Giftwolke am Fadenkreuz. Gegnerische Bakterien darin zerfallen.',
      'cryo-pulse':
        'Schockfrostet den Gegner: Er bewegt sich, teilt sich und erholt sich kaum noch.',
      'phage-strike':
        'Phagen brechen hervor und machen gegnerische Bakterien zu deinen. Sofort.',
      'agar-bloom':
        'Goldener Agar sprießt: Deine Bakterien darauf teilen sich wie verrückt.',
      'biofilm-shield':
        'Deine ganze Kolonie verhärtet sich und steckt den meisten Schaden weg.',
    },
  },
  preview: {
    label: 'Deine Kolonie, wie sie sich entwickelt hat',
  },
  reset: {
    button: 'Alles zurücksetzen',
    title: 'Ganz von vorn?',
    text: 'Alle Gene und Waffen gehen, jeder DNA-Strang kommt zurück. Kostenlos, so oft du willst.',
    confirm: 'Zurücksetzen',
    cancel: 'Behalten',
  },
  announce: {
    gene: '{name} auf Stufe {level} entwickelt.',
    maxed: '{name} voll entwickelt!',
    weapon: '{name} gehört dir.',
    equipped: '{name} ausgerüstet.',
    unequipped: 'Keine Waffe ausgerüstet.',
    reset: 'Alles zurückgesetzt – {count} DNA zurück.',
  },
  menu: {
    tile: 'Evolution',
    ready: '{count} DNA zum Ausgeben',
  },
  match: {
    dna: '+{count} DNA',
    evolve: 'Entwickeln',
  },
  profile: {
    earned: 'Verdiente DNA',
  },
  help: {
    title: 'Evolution',
    dna: 'Alle 50 XP, die du verdienst, lassen einen DNA-Strang wachsen. Gib ihn im Evolution-Bildschirm aus.',
    genes:
      'Gene machen deine Kolonie stärker, je fünf Stufen: schnellere Teilung, härtere Bisse, eine zähere Membran, flinkere Geißeln, ein heißerer Stoffwechsel.',
    weapons:
      'Waffen sind Spezialangriffe. Rüste eine aus und feuere sie mit der zweiten Taste neben dem Boost aufs Fadenkreuz – dann lädt sie wieder auf.',
    fair: 'Das alles zählt gegen den Computer in der Kampagne und auf generierten Levels, dort auch gegen deinen Geist, der mit dem spielt, was sein Lauf hatte. Das Tageslevel, Endlos-Läufe, Duelle am Gerät und Online-Matches bleiben ohne. Setz jederzeit zurück und bekomm jeden Strang zurück.',
  },
  pad: {
    button: '{weapon} abfeuern',
    ready: 'Feuer',
    active: 'Aktiv',
    cooldown: '{seconds}s',
    recharge: 'Waffe lädt auf',
  },
};
