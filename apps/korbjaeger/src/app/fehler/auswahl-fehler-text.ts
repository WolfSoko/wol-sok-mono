import {
  AUSWAHL_GRENZEN,
  type AuswahlListe,
} from '../auswahl/auswahl-dokument';
import { AuswahlVollError, AuswahlZuNeuError } from '../auswahl/auswahl-fehler';
import { KeineFarbeError } from '../vereinsfarben/vereinsfarben';

/** What a screen says when a list is full, by the list. */
const VOLL: Readonly<Record<AuswahlListe, string>> = {
  teams: `Du folgst schon ${AUSWAHL_GRENZEN.teams} Teams. Entfolge erst einem, um einem neuen zu folgen.`,
  kinder: `Du hast schon ${AUSWAHL_GRENZEN.kinder} Kinder markiert. Nimm erst eine Markierung weg, um ein neues zu markieren.`,
  vereinsfarben: `Du hast schon ${AUSWAHL_GRENZEN.vereinsfarben} Vereinen Farben gegeben. Setz erst die Farben eines Vereins zurück, um einem neuen welche zu geben.`,
};

/** What a screen says when a change to Meine Teams, Kinder or Vereinsfarben was not stored. */
export function auswahlFehlerText(fehler: unknown): string {
  if (fehler instanceof AuswahlZuNeuError) {
    return 'Eine neuere Version der App hat Meine Teams und Kinder gespeichert. Bitte die App neu laden.';
  }
  if (fehler instanceof AuswahlVollError) {
    return VOLL[fehler.liste];
  }
  if (fehler instanceof KeineFarbeError) {
    return 'Das ist keine Farbe, die sich speichern lässt. Bitte eine andere wählen.';
  }
  return 'Das ließ sich nicht speichern. Bitte noch einmal versuchen.';
}
