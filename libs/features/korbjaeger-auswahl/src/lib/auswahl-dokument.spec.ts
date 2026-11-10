import {
  auswahlDokumentLesen,
  auswahlFelder,
  geschriebeneTeamsSeit,
  mitTeamsSeit,
} from './auswahl-dokument';
import { ENTFERNT } from './auswahl-eintraege';
import { LEERE_AUSWAHL, type AuswahlInhalt } from './auswahl-listen';

describe('auswahlDokumentLesen', () => {
  it("reads each Team's seit", () => {
    const gelesen = auswahlDokumentLesen({
      version: 3,
      teams: { 201500: 20, 313036: 10 },
      children: {},
    });

    expect(gelesen.art === 'aktuell' && gelesen.teamsSeit).toEqual(
      new Map([
        [313036, 10],
        [201500, 20],
      ])
    );
  });

  it('reads a document of an earlier version as none', () => {
    expect(
      auswahlDokumentLesen({ version: 2, teams: { 313036: 1 }, kinder: {} })
    ).toEqual({ art: 'keins' });
  });
});

describe('auswahlFelder', () => {
  it("writes a new Team's known seit, the next one for the others", () => {
    const vorher: AuswahlInhalt = { ...LEERE_AUSWAHL, teams: [313036] };
    const nachher: AuswahlInhalt = {
      ...LEERE_AUSWAHL,
      teams: [201765, 313036, 201500],
      teamsSeit: new Map([
        [201765, 5],
        [313036, 10],
      ]),
    };

    expect(auswahlFelder(vorher, nachher, 100)).toEqual({
      teams: { 201765: 5, 201500: 100 },
    });
  });
});

describe('mitTeamsSeit', () => {
  it('gives the Teams it holds the seit a write stores for them', () => {
    const inhalt: AuswahlInhalt = { ...LEERE_AUSWAHL, teams: [313036, 201500] };

    const seiten = geschriebeneTeamsSeit({
      teams: { 201500: 42, 201765: 43, 313036: ENTFERNT },
    });

    expect(seiten).toEqual(
      new Map([
        [201500, 42],
        [201765, 43],
      ])
    );
    expect(mitTeamsSeit(inhalt, seiten).teamsSeit).toEqual(
      new Map([[201500, 42]])
    );
  });
});
