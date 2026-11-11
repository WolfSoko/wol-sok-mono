import {
  SELECTION_LIMITS,
  type SelectionList,
  SelectionFullError,
  SelectionTooNewError,
  NotAColorError,
} from '@wolsok/feat-korbjaeger-selection';

/** What a screen says when a list is full, by the list. */
const VOLL: Readonly<Record<SelectionList, string>> = {
  teams: `Du folgst schon ${SELECTION_LIMITS.teams} Teams. Entfolge erst einem, um einem neuen zu folgen.`,
  children: `Du hast schon ${SELECTION_LIMITS.children} Kinder markiert. Nimm erst eine Markierung weg, um ein neues zu markieren.`,
  clubColors: `Du hast schon ${SELECTION_LIMITS.clubColors} Vereinen Farben gegeben. Setz erst die Farben eines Vereins zurück, um einem neuen welche zu geben.`,
};

/** What a screen says when a change to Meine Teams, Kinder or Vereinsfarben was not stored. */
export function auswahlFehlerText(fehler: unknown): string {
  if (fehler instanceof SelectionTooNewError) {
    return 'Eine neuere Version der App hat Meine Teams und Kinder gespeichert. Bitte die App neu laden.';
  }
  if (fehler instanceof SelectionFullError) {
    return VOLL[fehler.list];
  }
  if (fehler instanceof NotAColorError) {
    return 'Das ist keine Farbe, die sich speichern lässt. Bitte eine andere wählen.';
  }
  return 'Das ließ sich nicht speichern. Bitte noch einmal versuchen.';
}
