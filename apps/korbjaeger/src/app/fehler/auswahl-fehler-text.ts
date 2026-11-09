import { AUSWAHL_GRENZEN } from '../auswahl/auswahl-dokument';
import { AuswahlVollError, AuswahlZuNeuError } from '../auswahl/auswahl-fehler';

/** What a screen says when a change to Meine Teams or Kinder was not stored. */
export function auswahlFehlerText(fehler: unknown): string {
  if (fehler instanceof AuswahlZuNeuError) {
    return 'Eine neuere Version der App hat Meine Teams und Kinder gespeichert. Bitte die App neu laden.';
  }
  if (fehler instanceof AuswahlVollError) {
    return fehler.liste === 'teams'
      ? `Du folgst schon ${AUSWAHL_GRENZEN.teams} Teams. Entfolge erst einem, um einem neuen zu folgen.`
      : `Du hast schon ${AUSWAHL_GRENZEN.kinder} Kinder markiert. Nimm erst eine Markierung weg, um ein neues zu markieren.`;
  }
  return 'Das ließ sich nicht speichern. Bitte noch einmal versuchen.';
}
