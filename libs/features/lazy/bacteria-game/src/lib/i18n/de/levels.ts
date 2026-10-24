import type { levels as en } from '../en/levels';
import type { Translation } from '../translation';

export const levels: Translation<typeof en> = {
  name: '{number} · {title}',
  titles: {
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
  },
  descriptions: {
    'petri-dish':
      'Offenes Gelände und ein langsamer Krieg – Platz, um zu lernen, wie man eine Kolonie steuert.',
    corridors:
      'Zwei Wände mit versetzten Lücken, die alle paar Sekunden zuschlagen. Komm durch, bevor der Gegner – oder das Tor – es tut.',
    hourglass:
      'Eine schmale Taille in der Mitte, die sich ab und zu schließt, und reichlich Futter. Wer die Lücke hält, entscheidet das Match.',
    'inner-ring':
      'Ein ummauerter Ring mit einer Tür auf jeder Seite, überall Futter und Kolonien, die Streit suchen.',
    'pillar-field':
      'Überall Säulen und weniger Zeit bis zum Tod – die Front zerfällt in Nester.',
    'twin-chambers':
      'Große Kolonien hinter ihren eigenen Mauern – hier wird eher übernommen als getötet.',
    serpentine:
      'Ein gewundener Pfad, unerbittliche Kolonien und Teilung mit voller Kraft. Keine sichere Ecke mehr.',
    pistons:
      'Zwei Schiebebalken fegen durch die Mitte und schieben beide Kolonien herum. Stoß im richtigen Moment zwischen ihnen durch.',
    alveoli:
      'Dicht gepackte Lungenbläschen und nichts Gerades dazwischen. Fädle deine Kolonie durch die Kanäle, bevor der Gegner sie flutet.',
    mycelium:
      'Pilzfäden wachsen von beiden Rändern herein – ein Labyrinth, das niemand geplant hat, mit unruhigen Kolonien in jeder Nische.',
    heartbeat:
      'Ein Herz in der Mitte schwillt mit jedem Schlag an und stößt beide Kolonien weg. Schlag zwischen den Schlägen zu.',
    villi:
      'Die Darmwand: Weiche Finger wiegen sich von beiden Rändern herein und reißen alles mit. Der letzte und härteste Krieg.',
    'half-life':
      'Der Reaktor schaltet nach zweieinhalb Minuten ab – dann gewinnt, wer die größere Kolonie hat. Vernichte den Gegner früher für die besseren Medaillen.',
    containment:
      'Goldener Agar in der Mitte verdoppelt die Teilung, violettes Antibiotikum an den Flanken tötet, wer zu lange bleibt. Eis bremst, Hitze hetzt deine Kolonie auf den Gegner.',
    'control-room':
      'Nimm die weiße Zone in der Mitte und halte sie: Wer dreißig Sekunden lang die meisten Bakterien darauf hat, gewinnt. Oder vernichte den Gegner vorher.',
    meltdown:
      'Der Reaktor schmilzt, und darin wächst etwas Riesiges: ein Boss, doppelt so groß wie du, der sich schneller teilt und härter zuschlägt. Überlebe eine Minute – oder vernichte ihn.',
    'patient-zero':
      'Wo alles begann: ein Boss, anderthalbmal so groß wie du, schnell beim Teilen und schnell beim Boost. Keine Uhr, keine Zone zum Verstecken – nur einer von euch bleibt übrig.',
    quarantine:
      'Zwei graue Kolonien sitzen isoliert zwischen dir und dem Gegner. Niemand steuert sie, und sie wehren sich nur schwach – wer sie zuerst frisst, hat die größere Armee.',
    'feeding-ground':
      'Überall Futter und Kolonien, zu träge zum Kämpfen. Wer zuerst 40 Pellets frisst, gewinnt – ein Pellet geht an den, der am meisten davon gefressen hat.',
    expanse:
      'Viermal so viel Platz, übersät mit Felsen, und zwei graue Kolonien zum Fressen. Die Kamera folgt dir – zoom mit dem Mausrad heraus, um den Gegner zu finden. Nach vier Minuten gewinnt die größte Kolonie.',
    archipelago:
      'Inseln in einem Meer aus Antibiotikum, verbunden durch schmale Brücken. Halte die weiße Zone auf der Insel in der Mitte vierzig Sekunden lang – der Weg dorthin führt über die Inseln im Norden und im Süden.',
    bloodstream:
      'Drei Adern nebeneinander, zwischen dir und dem Gegner schlägt ein Herz – jeder Schlag drückt den Weg daran vorbei zusammen. Klappen, die sich abwechselnd öffnen und zusammenziehen, führen hinaus in die äußeren Adern, heiß beim Herzen und eisig an den fernen Enden. Nach vier Minuten gewinnt die größte Kolonie.',
    'root-network':
      'Eine Höhle voller Säulen, überwuchert von Pilzfäden. Zwei graue Kolonien sitzen in Mulden auf goldenem Agar, weiterer Agar liegt in Nischen am Weg. Nach drei Minuten gewinnt die größte Kolonie.',
    leviathan:
      'Unten in der Tiefsee lebt etwas, viermal so groß wie du – es teilt sich schneller, schlägt härter zu und boostet öfter. Halte deine Kolonie zweieinhalb Minuten am Leben, oder vernichte den Leviathan.',
  },
  chapters: {
    petri: {
      name: 'Petri',
      blurb: 'Steuern, der Boost, das Futter – und ein erstes Tor.',
    },
    laboratory: {
      name: 'Labor',
      blurb: 'Deckung, Kammern und Wände, die sich bewegen.',
    },
    body: {
      name: 'Körper',
      blurb: 'Lebende Wände, die wachsen, schlagen und sich wiegen.',
    },
    reactor: {
      name: 'Reaktor',
      blurb:
        'Eine Uhr, Boden, der zurückschlägt, eine Zone zum Halten – und ein Boss.',
    },
    outbreak: {
      name: 'Ausbruch',
      blurb:
        'Bosse, größer als du, graue Kolonien, die niemand steuert, ein Wettfressen.',
    },
    expanse: {
      name: 'Weite',
      blurb:
        'Karten, größer als der Bildschirm – die Kamera folgt dir über Inseln, Adern und Höhlen bis zum Leviathan.',
    },
  },
  rules: {
    timed: 'Auf Zeit · {clock}',
    survive: 'Überleben · {clock}',
    hold: 'Zone halten · {clock}',
    harvest: {
      one: 'Ernte · {count} Pellet',
      other: 'Ernte · {count} Pellets',
    },
  },
  locks: {
    ladder: 'Gewinne {title} zum Freischalten',
    online: 'Zu groß für ein Online-Match',
  },
  generated: {
    styles: {
      field: {
        label: 'Feld',
        description:
          'Offenes Gelände mit Säulen als Deckung – Masse schlägt Schläue.',
      },
      corridor: {
        label: 'Korridore',
        description: 'Wände von Rand zu Rand, mit Lücken zum Durchbrechen.',
      },
      fortress: {
        label: 'Festung',
        description:
          'Eine Burg um jede Kolonie, mit Toren zum Halten oder Stürmen.',
      },
      cave: {
        label: 'Höhle',
        description:
          'Runde Wände wie lebendes Gewebe – gewundene Kanäle, keine Geraden.',
      },
    },
    // Stems: each noun adds the ending its gender asks for.
    adjectives: {
      quiet: 'Still',
      rusty: 'Rostig',
      hollow: 'Hohl',
      bitter: 'Bitter',
      silent: 'Stumm',
      restless: 'Ruhelos',
      pale: 'Blass',
      hungry: 'Hungrig',
      crooked: 'Krumm',
      sunken: 'Versunken',
      feral: 'Wild',
      glassy: 'Gläsern',
    },
    nouns: {
      meadow: '{adjective}e Wiese',
      flats: '{adjective}e Ebene',
      garden: '{adjective}er Garten',
      plain: '{adjective}e Flur',
      shallows: '{adjective}e Untiefen',
      corridors: '{adjective}e Korridore',
      halls: '{adjective}e Hallen',
      passage: '{adjective}e Passage',
      lanes: '{adjective}e Gassen',
      locks: '{adjective}e Schleusen',
      keep: '{adjective}er Bergfried',
      bastion: '{adjective}e Bastion',
      citadel: '{adjective}e Zitadelle',
      ramparts: '{adjective}e Wälle',
      redoubt: '{adjective}e Schanze',
      caverns: '{adjective}e Höhlen',
      grotto: '{adjective}e Grotte',
      hollows: '{adjective}e Senken',
      burrow: '{adjective}er Bau',
      tissue: '{adjective}es Gewebe',
    },
  },
};
