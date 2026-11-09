// What the app uses, and no more: the change functions, the document's fields
// and the merge stay inside the lib.
export { type Auswahl } from './lib/auswahl';
export { inhaltAus } from './lib/auswahl-aenderungen';
export {
  AUSWAHL_GRENZEN,
  AUSWAHL_LISTEN,
  type AuswahlInhalt,
  type AuswahlListe,
  LEERE_AUSWAHL,
  auswahlDokumentLesen,
} from './lib/auswahl-dokument';
export { AuswahlVollError, AuswahlZuNeuError } from './lib/auswahl-fehler';
export { FirestoreAuswahl, auswahlDokumentVon } from './lib/firestore-auswahl';
export { geraetUebernehmen } from './lib/geraet-uebernehmen';
export { gleicheFolge } from './lib/gleiche-folge';
export {
  type Kind,
  type MarkierbarerSpieler,
  SPITZNAME_CODEPUNKTE,
  SPITZNAME_LAENGE,
  spitznameZeichen,
} from './lib/kind';
export { AUSWAHL_SCHLUESSEL, LokaleAuswahl } from './lib/lokale-auswahl';
export { istSpeicherVoll } from './lib/speicher-voll';
export {
  KeineFarbeError,
  type Vereinsfarben,
  gleicheFarben,
  vereinsfarbenAus,
} from './lib/vereinsfarben';
export {
  type VereinsfarbenWahl,
  vereinsfarbenVon,
} from './lib/vereinsfarben-wahl';
export { type NichtUebernommen } from './lib/zusammenfuehren';
