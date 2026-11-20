import { BlogFigure } from '../../blog-figure';

const BASE = '/blog/bacteria-wars-turn-relay';

/** The pictures of the TURN relay article, in the order it shows them. */
export const TURN_RELAY_FIGURES = {
  walls: {
    src: `${BASE}/nat-walls.svg`,
    width: 960,
    height: 480,
    alt: {
      en: 'Two cartoon bacteria colonies, each on its own phone, shout “Can you hear me?” at each other through two brick walls labelled NAT.',
      de: 'Zwei Comic-Bakterienkolonien, jede auf ihrem eigenen Handy, rufen sich durch zwei Backsteinmauern mit der Aufschrift NAT „Hörst du mich?“ zu.',
    },
    caption: {
      en: 'The bug report, drawn: both players are online, neither can reach the other.',
      de: 'Der Fehlerbericht als Bild: Beide Spieler sind online, keiner erreicht den anderen.',
    },
  },
  nat: {
    src: `${BASE}/nat-problem.svg`,
    width: 960,
    height: 520,
    alt: {
      en: 'Diagram: phone A behind NAT A and phone B behind NAT B. A packet from B to A’s public address is dropped by NAT A, because A never sent anything to B’s address. A symmetric NAT hands out a different public port for every destination.',
      de: 'Diagramm: Handy A hinter NAT A, Handy B hinter NAT B. Ein Paket von B an die öffentliche Adresse von A verwirft NAT A, weil A nie etwas an die Adresse von B geschickt hat. Ein symmetrisches NAT vergibt für jedes Ziel einen anderen öffentlichen Port.',
    },
    caption: {
      en: 'A NAT only lets in answers to packets that went out, and a symmetric NAT gives every destination a port of its own: the address A learned from STUN is not the one B would have to use.',
      de: 'Ein NAT lässt nur Antworten auf Pakete herein, die hinausgingen, und ein symmetrisches NAT gibt jedem Ziel einen eigenen Port: Die Adresse, die A über STUN erfährt, ist nicht die, die B nehmen müsste.',
    },
  },
  stunTurn: {
    src: `${BASE}/stun-turn.svg`,
    width: 960,
    height: 480,
    alt: {
      en: 'Cartoon: on the left a bacterium looks into a mirror labelled STUN that says “You look like 203.0.113.7:51234”. On the right a bacterium in a postman’s cap labelled TURN carries a sack of packets between two walls.',
      de: 'Comic: Links schaut ein Bakterium in einen Spiegel mit der Aufschrift STUN, der sagt „Du siehst aus wie 203.0.113.7:51234“. Rechts trägt ein Bakterium mit Postmütze und der Aufschrift TURN einen Sack voller Pakete zwischen zwei Mauern hin und her.',
    },
    caption: {
      en: 'STUN is a mirror: it tells you the address the internet sees. TURN is a postman: it carries every packet for you.',
      de: 'STUN ist ein Spiegel: Er sagt dir, unter welcher Adresse dich das Internet sieht. TURN ist ein Briefträger: Er trägt jedes Paket für dich.',
    },
  },
  ice: {
    src: `${BASE}/ice-candidates.svg`,
    width: 960,
    height: 540,
    alt: {
      en: 'Diagram of the three kinds of ICE candidates: host (the device’s own address, hidden behind an mDNS name), server-reflexive (the public address STUN reports) and relay (an address on the TURN server). ICE checks the pairs from cheapest to most expensive; the relay pair always works.',
      de: 'Diagramm der drei Arten von ICE-Kandidaten: host (die eigene Adresse des Geräts, hinter einem mDNS-Namen versteckt), server-reflexive (die öffentliche Adresse, die STUN meldet) und relay (eine Adresse auf dem TURN-Server). ICE prüft die Paare vom billigsten zum teuersten; das Relay-Paar klappt immer.',
    },
    caption: {
      en: 'ICE tries the direct paths first. The relay candidate is the one that always works, and the one that costs money.',
      de: 'ICE probiert zuerst die direkten Wege. Der Relay-Kandidat ist der, der immer klappt, und der, der Geld kostet.',
    },
  },
  wiring: {
    src: `${BASE}/wiring.svg`,
    width: 960,
    height: 640,
    alt: {
      en: 'Sequence diagram: every 30 minutes the scheduled function refreshRelay asks Cloudflare for credentials and writes them to the Firestore document relay/turn. Before a match the host and the guest each read that document, exchange offer and answer through the room document rooms/{code}, and then talk over a WebRTC data channel, through the Cloudflare TURN server if needed.',
      de: 'Sequenzdiagramm: Alle 30 Minuten holt die zeitgesteuerte Funktion refreshRelay Zugangsdaten bei Cloudflare und schreibt sie ins Firestore-Dokument relay/turn. Vor einem Match lesen Host und Gast jeweils dieses Dokument, tauschen Angebot und Antwort über das Raumdokument rooms/{code} und sprechen dann über einen WebRTC-Datenkanal, wenn nötig über den TURN-Server von Cloudflare.',
    },
    caption: {
      en: 'The game never calls a function. A scheduled function keeps one document fresh, and the players only read it.',
      de: 'Das Spiel ruft nie eine Funktion auf. Eine zeitgesteuerte Funktion hält ein Dokument frisch, und die Spieler lesen es nur.',
    },
  },
  renewal: {
    src: `${BASE}/renewal-timeline.svg`,
    width: 960,
    height: 440,
    alt: {
      en: 'Timeline over 90 minutes: credentials last 60 minutes and are refreshed every 30 minutes, so a reader gets at least 30 minutes. A link without renewal dies once its credentials expire. With an ICE restart every 15 minutes the link lives on.',
      de: 'Zeitleiste über 90 Minuten: Zugangsdaten gelten 60 Minuten und werden alle 30 Minuten erneuert, ein Leser bekommt also mindestens 30 Minuten. Eine Verbindung ohne Erneuerung stirbt, sobald ihre Zugangsdaten ablaufen. Mit einem ICE-Restart alle 15 Minuten lebt sie weiter.',
    },
    caption: {
      en: 'Fresh credentials alone do not save a relayed link. An ICE restart with them does, so the host runs one every 15 minutes.',
      de: 'Frische Zugangsdaten allein retten eine Relay-Verbindung nicht. Ein ICE-Restart mit ihnen schon, also macht der Host alle 15 Minuten einen.',
    },
  },
} satisfies Record<string, BlogFigure>;
