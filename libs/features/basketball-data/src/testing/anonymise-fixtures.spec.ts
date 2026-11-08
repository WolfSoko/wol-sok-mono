import { anonymiseFixtures, survivingPersonData } from './anonymise-fixtures';
import { INVENTED_ID_BASE } from './invented-names';

const SEED = 'spec';

/** Two responses that share one player, as a boxscore and a matchInfo do. */
const ORIGINAL = {
  'boxscore.json': {
    status: '0',
    data: {
      matchId: 2911141,
      homeTeam: { teamPermanentId: 156618, clubId: 1476, teamname: 'Post SV' },
      matchBoxscore: {
        homePlayerStats: [
          {
            pts: 12,
            player: {
              playerId: 4456015,
              no: '7',
              person: {
                id: 881456,
                vorname: 'Darian',
                nachname: 'Kabir',
                anonym: false,
              },
              anonym: false,
            },
          },
          {
            pts: 10,
            player: {
              playerId: 0,
              no: '**',
              person: { id: 0, vorname: '***', nachname: '****', anonym: true },
              anonym: true,
            },
          },
        ],
      },
    },
  },
  'matchinfo.json': {
    status: '0',
    data: {
      matchId: 2911141,
      club: { vereinId: 1476, kontaktData: { telefon: '0911 123456' } },
      matchInfo: {
        topPerformances: [
          {
            performance: 'Punkte',
            playerA: {
              playerId: 4456015,
              person: {
                id: 881456,
                vorname: 'Darian',
                nachname: 'Kabir',
                anonym: false,
              },
            },
          },
        ],
        spielfeld: { id: 2132, bezeichnung: 'Basketball Center Hauptsmoor' },
        srList: [
          {
            personData: {
              id: 32946,
              vorname: 'Matthias',
              nachname: 'Wadenstorfer',
              anonym: false,
            },
          },
        ],
      },
    },
  },
};

const ORIGINAL_NAMES = ['Darian', 'Kabir', 'Matthias', 'Wadenstorfer'];
const ORIGINAL_PERSON_IDS = [881456, 4456015, 32946];

describe('anonymiseFixtures', () => {
  const anonymised = anonymiseFixtures(ORIGINAL, SEED);
  const text = JSON.stringify(anonymised);

  it('lets no original name or person id survive', () => {
    for (const name of ORIGINAL_NAMES) {
      expect(text).not.toContain(name);
    }
    for (const id of ORIGINAL_PERSON_IDS) {
      expect(text).not.toContain(String(id));
    }
    expect(survivingPersonData(ORIGINAL, anonymised)).toEqual([]);
  });

  it('reports a name left in free text, so the CLI refuses to write it', () => {
    const withNote = {
      ...ORIGINAL,
      'note.json': {
        status: '0',
        data: { note: 'Gut gespielt, Darian Kabir!' },
      },
    };

    expect(
      survivingPersonData(withNote, anonymiseFixtures(withNote, SEED))
    ).toEqual(['full name Darian Kabir']);
  });

  it('reports an invented name that happens to be a real one', () => {
    const real = anonymiseFixtures(ORIGINAL, SEED);
    const invented = player(real, 'boxscore.json').person;
    const namesake = {
      'namesake.json': {
        data: {
          person: {
            id: 5,
            vorname: invented.vorname,
            nachname: 'X',
            anonym: false,
          },
        },
      },
    };
    const both = { ...ORIGINAL, ...namesake };

    expect(survivingPersonData(both, anonymiseFixtures(both, SEED))).toContain(
      `name ${invented.vorname}`
    );
  });

  it('gives one person the same invented id and name in every file', () => {
    const box = player(anonymised, 'boxscore.json');
    const top = topPlayer(anonymised);

    expect(box.playerId).toBeGreaterThanOrEqual(INVENTED_ID_BASE);
    expect(box.person.id).toBeGreaterThanOrEqual(INVENTED_ID_BASE);
    expect(top.playerId).toBe(box.playerId);
    expect(top.person).toEqual(box.person);
  });

  it('keeps the ids of Teams, Vereine, Ligen, Spiele and Hallen', () => {
    expect(text).toContain('"matchId":2911141');
    expect(text).toContain('"teamPermanentId":156618');
    expect(text).toContain('"clubId":1476');
    expect(text).toContain('"vereinId":1476');
    expect(text).toContain('"id":2132');
  });

  it('leaves players the DBB hides as they are', () => {
    expect(text).toContain(
      '"person":{"id":0,"vorname":"***","nachname":"****","anonym":true}'
    );
  });

  it('drops contact details', () => {
    expect(text).not.toContain('0911');
    expect(text).toContain('"kontaktData":null');
  });

  it('is deterministic for a seed and differs between seeds', () => {
    expect(anonymiseFixtures(ORIGINAL, SEED)).toEqual(anonymised);
    expect(
      player(anonymiseFixtures(ORIGINAL, 'other'), 'boxscore.json').person.id
    ).not.toBe(player(anonymised, 'boxscore.json').person.id);
  });

  it('does not change its input', () => {
    expect(JSON.stringify(ORIGINAL)).toContain('Wadenstorfer');
  });
});

interface SpecPlayer {
  readonly playerId: number;
  readonly person: {
    readonly id: number;
    readonly vorname: string;
    readonly nachname: string;
  };
}

function player(
  files: Readonly<Record<string, unknown>>,
  name: string
): SpecPlayer {
  const file = files[name] as {
    data: { matchBoxscore: { homePlayerStats: { player: SpecPlayer }[] } };
  };
  return file.data.matchBoxscore.homePlayerStats[0].player;
}

function topPlayer(files: Readonly<Record<string, unknown>>): SpecPlayer {
  const file = files['matchinfo.json'] as {
    data: { matchInfo: { topPerformances: { playerA: SpecPlayer }[] } };
  };
  return file.data.matchInfo.topPerformances[0].playerA;
}
