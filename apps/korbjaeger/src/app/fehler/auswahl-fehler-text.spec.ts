import {
  SELECTION_LIMITS,
  SelectionFullError,
  SelectionTooNewError,
  NotAColorError,
} from '@wolsok/feat-korbjaeger-selection';
import { auswahlFehlerText } from './auswahl-fehler-text';

describe('auswahlFehlerText', () => {
  it('names the list that is full, with its cap', () => {
    expect(auswahlFehlerText(new SelectionFullError('teams'))).toContain(
      `${SELECTION_LIMITS.teams} Teams`
    );
    expect(auswahlFehlerText(new SelectionFullError('children'))).toContain(
      `${SELECTION_LIMITS.children} Kinder`
    );
    expect(auswahlFehlerText(new SelectionFullError('clubColors'))).toBe(
      `Du hast schon ${SELECTION_LIMITS.clubColors} Vereinen Farben gegeben. Setz erst die Farben eines Vereins zurück, um einem neuen welche zu geben.`
    );
  });

  it('says a colour that is none cannot be stored', () => {
    expect(auswahlFehlerText(new NotAColorError('rot'))).toBe(
      'Das ist keine Farbe, die sich speichern lässt. Bitte eine andere wählen.'
    );
  });

  it('asks to reload where a newer version stored the selection', () => {
    expect(auswahlFehlerText(new SelectionTooNewError())).toContain(
      'neu laden'
    );
  });

  it('asks to try again for any other failure', () => {
    expect(auswahlFehlerText(new Error('offline'))).toBe(
      'Das ließ sich nicht speichern. Bitte noch einmal versuchen.'
    );
  });
});
