import { istBenannt } from '../domain/spielbericht';
import { caughtError } from '../../testing/caught-error';
import { readEnvelope } from './envelope';
import keinBericht from './fixtures/boxscore-2843814.json';
import nurKader from './fixtures/boxscore-2843811.json';
import mitWerten from './fixtures/boxscore-2911141.json';
import { mapSpielbericht } from './map-spielbericht';

describe('mapSpielbericht', () => {
  describe('where the Verband records Spielerwerte (Bayern)', () => {
    const bericht = mapSpielbericht(readEnvelope(mitWerten));

    it('says so', () => {
      expect(bericht?.spielId).toBe(2911141);
      expect(bericht?.spielerwerteErfasst).toBe(true);
    });

    it('reads a named player with their Spielerwerte', () => {
      expect(bericht?.gast[1]).toEqual({
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
      expect(bericht?.heim[0]).toEqual({
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
        bericht?.gast.filter((eintrag) => !istBenannt(eintrag))
      ).toHaveLength(2);
    });

    it('leaves out shirt numbers where the Kader lists 0 for everyone', () => {
      const benannte = (bericht?.heim ?? []).filter(istBenannt);

      expect(benannte.map((spieler) => spieler.trikotnummer)).toEqual(
        benannte.map(() => undefined)
      );
    });

    it('reads every number of a Kader, adding up to the result', () => {
      const punkte = (bericht?.heim ?? []).reduce(
        (sum, eintrag) => sum + (eintrag.spielerwerte?.punkte ?? 0),
        0
      );

      expect(punkte).toBe(99);
    });
  });

  describe('where the Verband records the Kader only (Schleswig-Holstein)', () => {
    const bericht = mapSpielbericht(readEnvelope(nurKader));

    it('says no Spielerwerte were recorded and gives no zeros', () => {
      expect(bericht?.spielerwerteErfasst).toBe(false);
      expect(
        [...(bericht?.heim ?? []), ...(bericht?.gast ?? [])].every(
          (e) => e.spielerwerte === undefined
        )
      ).toBe(true);
    });

    it('reads both Kader with names and shirt numbers', () => {
      expect(bericht?.heim).toHaveLength(11);
      expect(bericht?.gast).toHaveLength(11);
      expect(bericht?.heim[0]).toEqual({
        art: 'benannt',
        personId: 92256481,
        vorname: 'Delon',
        nachname: 'Nesselbach',
        trikotnummer: '30',
      });
    });
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
