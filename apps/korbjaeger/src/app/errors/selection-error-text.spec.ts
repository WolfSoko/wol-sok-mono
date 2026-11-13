import {
  SELECTION_LIMITS,
  SelectionFullError,
  SelectionTooNewError,
  NotAColorError,
} from '@wolsok/feat-korbjaeger-selection';
import { selectionErrorText } from './selection-error-text';

describe('selectionErrorText', () => {
  it('names the list that is full, with its cap', () => {
    expect(selectionErrorText(new SelectionFullError('teams'))).toContain(
      `${SELECTION_LIMITS.teams} Teams`
    );
    expect(selectionErrorText(new SelectionFullError('children'))).toContain(
      `${SELECTION_LIMITS.children} Kinder`
    );
    expect(selectionErrorText(new SelectionFullError('clubColors'))).toBe(
      `Du hast schon ${SELECTION_LIMITS.clubColors} Vereinen Farben gegeben. Setz erst die Farben eines Vereins zurück, um einem neuen welche zu geben.`
    );
  });

  it('says a colour that is none cannot be stored', () => {
    expect(selectionErrorText(new NotAColorError('rot'))).toBe(
      'Das ist keine Farbe, die sich speichern lässt. Bitte eine andere wählen.'
    );
  });

  it('asks to reload where a newer version stored the selection', () => {
    expect(selectionErrorText(new SelectionTooNewError())).toContain(
      'neu laden'
    );
  });

  it('asks to try again for any other failure', () => {
    expect(selectionErrorText(new Error('offline'))).toBe(
      'Das ließ sich nicht speichern. Bitte noch einmal versuchen.'
    );
  });
});
