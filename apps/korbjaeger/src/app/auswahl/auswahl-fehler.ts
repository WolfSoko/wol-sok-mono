/**
 * The stored `Auswahl` was written by a newer version of the app. It is
 * left as it is: this version neither reads nor overwrites it.
 */
export class AuswahlZuNeuError extends Error {
  public constructor() {
    super('Auswahl: stored by a newer version of the app');
    this.name = 'AuswahlZuNeuError';
  }
}

/** What a screen says when a change to Meine Teams was not stored. */
export function auswahlFehlerText(fehler: unknown): string {
  return fehler instanceof AuswahlZuNeuError
    ? 'Eine neuere Version der App hat Meine Teams gespeichert. Bitte die App neu laden.'
    : 'Das ließ sich nicht speichern. Bitte noch einmal versuchen.';
}
