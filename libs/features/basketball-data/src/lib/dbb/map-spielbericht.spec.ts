import { istBenannt, spielerwerteErfasst } from '../domain/spielbericht';
import { caughtError } from '../../testing/caught-error';
import { readEnvelope } from './envelope';
import keinBericht from './fixtures/boxscore-2843814.json';
import nurKader from './fixtures/boxscore-2843811.json';
import mitWerten from './fixtures/boxscore-2911141.json';
import { mapSpielbericht } from './map-spielbericht';

describe('mapSpielbericht', () => {
  describe('where the Verband records Spielerwerte (Bayern)', () => {
    const bericht = mapSpielbericht(readEnvelope(mitWerten));

    it('says so for both Kader', () => {
      expect(bericht?.spielId).toBe(2911141);
      expect(bericht?.heim.spielerwerteErfasst).toBe(true);
      expect(bericht?.gast.spielerwerteErfasst).toBe(true);
      expect(bericht && spielerwerteErfasst(bericht)).toBe(true);
    });

    it('reads a named player with their Spielerwerte', () => {
      expect(bericht?.gast.eintraege[1]).toEqual({
        art: 'benannt',
        personId: 91692638,
        vorname: 'Ilvio',
        nachname: 'Mistelgrund',
        spielerwerte: {
          punkte: 29,
          zweier: 9,
          dreier: 3,
          freiwuerfe: { getroffen: 2, versucht: 7 },
          fouls: 3,
        },
      });
    });

    it('reads an Anonymer Spieler without person id or name, with their Spielerwerte', () => {
      expect(bericht?.heim.eintraege[0]).toEqual({
        art: 'anonym',
        spielerwerte: {
          punkte: 10,
          zweier: 4,
          dreier: 0,
          freiwuerfe: { getroffen: 2, versucht: 4 },
          fouls: 3,
        },
      });
      expect(
        bericht?.gast.eintraege.filter((eintrag) => !istBenannt(eintrag))
      ).toHaveLength(2);
    });

    it('leaves out shirt numbers where the Kader lists 0 for everyone', () => {
      const benannte = (bericht?.heim.eintraege ?? []).filter(istBenannt);

      expect(benannte.map((spieler) => spieler.trikotnummer)).toEqual(
        benannte.map(() => undefined)
      );
    });

    it('reads every number of a Kader, adding up to the result', () => {
      const punkte = (bericht?.heim.eintraege ?? []).reduce(
        (sum, eintrag) => sum + (eintrag.spielerwerte?.punkte ?? 0),
        0
      );

      expect(punkte).toBe(99);
    });
  });

  describe('where the Verband records the Kader only (Schleswig-Holstein)', () => {
    const bericht = mapSpielbericht(readEnvelope(nurKader));

    it('says no Spielerwerte were recorded and gives no zeros', () => {
      expect(bericht?.heim.spielerwerteErfasst).toBe(false);
      expect(bericht?.gast.spielerwerteErfasst).toBe(false);
      expect(bericht && spielerwerteErfasst(bericht)).toBe(false);
      expect(
        [
          ...(bericht?.heim.eintraege ?? []),
          ...(bericht?.gast.eintraege ?? []),
        ].every((e) => e.spielerwerte === undefined)
      ).toBe(true);
    });

    it('reads both Kader with names and shirt numbers', () => {
      expect(bericht?.heim.eintraege).toHaveLength(11);
      expect(bericht?.gast.eintraege).toHaveLength(11);
      expect(bericht?.heim.eintraege[0]).toEqual({
        art: 'benannt',
        personId: 92256481,
        vorname: 'Delon',
        nachname: 'Nesselbach',
        trikotnummer: '30',
      });
    });
  });

  describe('where only one Kader has numbers', () => {
    const data = readEnvelope(mitWerten) as {
      matchBoxscore: { guestPlayerStats: Record<string, unknown>[] };
    };
    const ohneGastWerte = {
      ...data,
      matchBoxscore: {
        ...data.matchBoxscore,
        guestPlayerStats: data.matchBoxscore.guestPlayerStats.map((stats) => ({
          ...stats,
          pts: 0,
          fouls: 0,
          twoPoints: { made: 0, attempted: 0, quota: null },
          threePoints: { made: 0, attempted: 0, quota: null },
          onePoints: { made: 0, attempted: 0, quota: null },
        })),
      },
    };
    const bericht = mapSpielbericht(ohneGastWerte);

    it('decides per Kader', () => {
      expect(bericht?.heim.spielerwerteErfasst).toBe(true);
      expect(bericht?.gast.spielerwerteErfasst).toBe(false);
      expect(bericht && spielerwerteErfasst(bericht)).toBe(true);
    });

    it('gives the unrecorded Kader no zeros', () => {
      expect(
        bericht?.gast.eintraege.every((e) => e.spielerwerte === undefined)
      ).toBe(true);
      expect(
        bericht?.heim.eintraege.every((e) => e.spielerwerte !== undefined)
      ).toBe(true);
    });
  });

  describe('an Anonymer Spieler', () => {
    const data = readEnvelope(nurKader) as {
      matchBoxscore: {
        homePlayerStats: {
          player: { anonym: boolean; person: Record<string, unknown> };
        }[];
      };
    };
    const [first] = data.matchBoxscore.homePlayerStats;

    it.each<[string, object, object]>([
      ['the player', { anonym: true }, {}],
      ['the person', {}, { anonym: true }],
      ['person id 0', {}, { id: 0 }],
    ])(
      'is one when %s says so, even with a name and id',
      (_case, player, person) => {
        const marked = {
          ...data,
          matchBoxscore: {
            ...data.matchBoxscore,
            homePlayerStats: [
              {
                ...first,
                player: {
                  ...first.player,
                  anonym: false,
                  ...player,
                  person: { ...first.player.person, anonym: false, ...person },
                },
              },
            ],
          },
        };

        expect(mapSpielbericht(marked)?.heim.eintraege[0]).toEqual({
          art: 'anonym',
        });
      }
    );
  });

  it('refuses a status-0 envelope with no boxscore fields at all', () => {
    expect(caughtError(() => mapSpielbericht({})).message).toBe(
      'boxscore.matchId: expected a number, got nothing'
    );
  });

  it('reads a Spiel without a Kader yet as without Spielbericht', () => {
    expect(mapSpielbericht(readEnvelope(keinBericht))).toBeUndefined();
    expect(
      mapSpielbericht({ matchId: 1, matchBoxscore: null })
    ).toBeUndefined();
  });

  it('refuses a named player without a person id', () => {
    const data = readEnvelope(nurKader) as {
      matchBoxscore: { homePlayerStats: { player: { person: object } }[] };
    };
    const [first] = data.matchBoxscore.homePlayerStats;
    const broken = {
      ...data,
      matchBoxscore: {
        ...data.matchBoxscore,
        homePlayerStats: [
          {
            ...first,
            player: {
              ...first.player,
              person: { vorname: 'A', nachname: 'B' },
            },
          },
        ],
      },
    };

    expect(caughtError(() => mapSpielbericht(broken)).message).toBe(
      'boxscore.matchBoxscore.homePlayerStats[0].player.person.id: expected a number, got nothing'
    );
  });
});
