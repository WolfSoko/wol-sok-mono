import {
  auswahlDokumentLesen,
  auswahlFelder,
  LEERE_AUSWAHL,
  ENTFERNT,
  mitTeamsSeit,
  type AuswahlInhalt,
} from './auswahl-dokument';

describe('auswahlDokumentLesen', () => {
  it("reads each Team's seit", () => {
    const gelesen = auswahlDokumentLesen({
      version: 2,
      teams: { 201500: 20, 313036: 10 },
      kinder: {},
    });

    expect(gelesen.art === 'aktuell' && gelesen.teamsSeit).toEqual(
      new Map([
        [313036, 10],
        [201500, 20],
      ])
    );
  });

  it("counts a version-1 list's Teams 1, 2, 3, as the write that makes it a map", () => {
    const gelesen = auswahlDokumentLesen({
      version: 1,
      teams: [313036, 201500],
      kinder: [],
    });

    expect(gelesen.art === 'aktuell' && gelesen.teamsSeit).toEqual(
      new Map([
        [313036, 1],
        [201500, 2],
      ])
    );
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

    const mit = mitTeamsSeit(inhalt, {
      teams: { 201500: 42, 201765: 43 },
    });

    expect(mit.teamsSeit).toEqual(new Map([[201500, 42]]));
  });

  it('is the same content where the write stores no Team', () => {
    const inhalt: AuswahlInhalt = { ...LEERE_AUSWAHL, teams: [313036] };

    expect(mitTeamsSeit(inhalt, { teams: { 313036: ENTFERNT } })).toBe(inhalt);
  });
});
