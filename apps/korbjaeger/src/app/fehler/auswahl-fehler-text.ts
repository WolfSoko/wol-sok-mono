import { AuswahlZuNeuError } from '../auswahl/auswahl-fehler';

/** What a screen says when a change to Meine Teams or Kinder was not stored. */
export function auswahlFehlerText(fehler: unknown): string {
  return fehler instanceof AuswahlZuNeuError
    ? 'Eine neuere Version der App hat Meine Teams und Kinder gespeichert. Bitte die App neu laden.'
    : 'Das ließ sich nicht speichern. Bitte noch einmal versuchen.';
}
