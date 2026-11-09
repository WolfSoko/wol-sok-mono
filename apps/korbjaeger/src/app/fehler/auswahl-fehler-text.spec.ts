import { AUSWAHL_GRENZEN } from '../auswahl/auswahl-dokument';
import { AuswahlVollError, AuswahlZuNeuError } from '../auswahl/auswahl-fehler';
import { KeineFarbeError } from '../vereinsfarben/vereinsfarben';
import { auswahlFehlerText } from './auswahl-fehler-text';

describe('auswahlFehlerText', () => {
  it('names the list that is full, with its cap', () => {
    expect(auswahlFehlerText(new AuswahlVollError('teams'))).toContain(
      `${AUSWAHL_GRENZEN.teams} Teams`
    );
    expect(auswahlFehlerText(new AuswahlVollError('kinder'))).toContain(
      `${AUSWAHL_GRENZEN.kinder} Kinder`
    );
    expect(auswahlFehlerText(new AuswahlVollError('vereinsfarben'))).toBe(
      `Du hast schon ${AUSWAHL_GRENZEN.vereinsfarben} Vereinen Farben gegeben. Setz erst die Farben eines Vereins zurück, um einem neuen welche zu geben.`
    );
  });

  it('says a colour that is none cannot be stored', () => {
    expect(auswahlFehlerText(new KeineFarbeError('rot'))).toBe(
      'Das ist keine Farbe, die sich speichern lässt. Bitte eine andere wählen.'
    );
  });

  it('asks to reload where a newer version stored the selection', () => {
    expect(auswahlFehlerText(new AuswahlZuNeuError())).toContain('neu laden');
  });

  it('asks to try again for any other failure', () => {
    expect(auswahlFehlerText(new Error('offline'))).toBe(
      'Das ließ sich nicht speichern. Bitte noch einmal versuchen.'
    );
  });
});
