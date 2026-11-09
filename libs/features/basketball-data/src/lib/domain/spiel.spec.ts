import type { Liga } from './liga';
import type { SpielPartei } from './partei';
import {
  ausgangVon,
  datumInDeutschland,
  ergebnisVon,
  ergebnisVorlaeufig,
  gegnerVon,
  seiteVon,
  istEntschieden,
  sonderfallVon,
  vergleicheAnwurf,
  type Spiel,
} from './spiel';

const UNS: SpielPartei = {
  art: 'team',
  team: { id: 313036, name: 'MTV Wasbüttel', vereinId: 1837 },
};
const GIFHORN: SpielPartei = {
  art: 'team',
  team: { id: 201500, name: 'MTV Gifhorn', vereinId: 1 },
};
const SLOT: SpielPartei = { art: 'offen', bezeichnung: 'Nord 1. Platz' };

function spiel(overrides: Partial<Spiel>): Spiel {
  return {
    id: 1,
    ligaId: 54862,
    spieltag: 1,
    datum: '2026-09-20',
    heim: UNS,
    gast: GIFHORN,
    status: { art: 'geplant' },
    ...overrides,
  };
}

describe('seiteVon', () => {
  it('finds the Team at home or away', () => {
    expect(seiteVon(spiel({}), 313036)).toBe('heim');
    expect(seiteVon(spiel({ heim: GIFHORN, gast: UNS }), 313036)).toBe('gast');
  });

  it('finds no side for a Team that does not play', () => {
    expect(seiteVon(spiel({ heim: GIFHORN, gast: SLOT }), 313036)).toBe(
      undefined
    );
  });
});

describe('gegnerVon', () => {
  it('names the other side', () => {
    expect(gegnerVon(spiel({ gast: SLOT }), 'heim')).toBe(SLOT);
    expect(gegnerVon(spiel({}), 'gast')).toBe(UNS);
  });
});

describe('ergebnisVon', () => {
  it('has the result of a played Spiel', () => {
    expect(
      ergebnisVon(
        spiel({
          status: {
            art: 'gespielt',
            ergebnis: { heim: 78, gast: 47 },
            bestaetigt: true,
          },
        })
      )
    ).toEqual({ heim: 78, gast: 47 });
  });

  it('has the result of a forfeit where the DBB gives one', () => {
    expect(
      ergebnisVon(
        spiel({
          status: {
            art: 'kampflos',
            verzichtet: ['gast'],
            ergebnis: { heim: 20, gast: 0 },
          },
        })
      )
    ).toEqual({ heim: 20, gast: 0 });
    expect(
      ergebnisVon(spiel({ status: { art: 'kampflos', verzichtet: [] } }))
    ).toBeUndefined();
  });

  it.each([{ art: 'geplant' }, { art: 'abgesagt' }] as const)(
    'has none while $art',
    (status) => {
      expect(ergebnisVon(spiel({ status }))).toBeUndefined();
    }
  );
});

describe('sonderfallVon', () => {
  it('tells a cancelled and a forfeited Spiel', () => {
    expect(sonderfallVon(spiel({ status: { art: 'abgesagt' } }))).toBe(
      'abgesagt'
    );
    expect(
      sonderfallVon(spiel({ status: { art: 'kampflos', verzichtet: [] } }))
    ).toBe('kampflos');
  });

  it('finds nothing special in a planned or played Spiel', () => {
    expect(sonderfallVon(spiel({}))).toBeUndefined();
    expect(
      sonderfallVon(
        spiel({
          status: {
            art: 'gespielt',
            ergebnis: { heim: 1, gast: 0 },
            bestaetigt: false,
          },
        })
      )
    ).toBeUndefined();
  });
});

describe('datumInDeutschland', () => {
  it.each([
    ['2026-11-08T12:00:00Z', '2026-11-08'],
    // after midnight in Germany, still the day before in UTC
    ['2026-11-08T23:30:00Z', '2026-11-09'],
    ['2026-07-31T22:30:00Z', '2026-08-01'],
    ['2026-11-08T22:59:00Z', '2026-11-08'],
    ['2027-01-05T08:00:00Z', '2027-01-05'],
  ])('dates %s as the DBB does: %s', (moment, datum) => {
    expect(datumInDeutschland(new Date(moment))).toBe(datum);
  });
});

describe('vergleicheAnwurf', () => {
  function anwurf(datum: string, uhrzeit?: string): Spiel {
    return {
      id: 1,
      ligaId: 1,
      spieltag: 1,
      datum,
      ...(uhrzeit && { uhrzeit }),
      heim: UNS,
      gast: GIFHORN,
      status: { art: 'geplant' },
    };
  }

  function reihe(...spiele: Spiel[]): readonly string[] {
    return [...spiele]
      .sort(vergleicheAnwurf)
      .map(({ datum, uhrzeit }) => `${datum} ${uhrzeit ?? 'offen'}`);
  }

  it('orders by day, then by tip-off', () => {
    expect(
      reihe(
        anwurf('2026-11-15', '09:00'),
        anwurf('2026-11-14', '15:30'),
        anwurf('2026-11-14', '09:30')
      )
    ).toEqual(['2026-11-14 09:30', '2026-11-14 15:30', '2026-11-15 09:00']);
  });

  it('puts a Spiel without a tip-off last on its day', () => {
    expect(
      reihe(
        anwurf('2026-11-15', '09:00'),
        anwurf('2026-11-14'),
        anwurf('2026-11-14', '15:30')
      )
    ).toEqual(['2026-11-14 15:30', '2026-11-14 offen', '2026-11-15 09:00']);
  });

  it('ties Spiele of one tip-off', () => {
    expect(vergleicheAnwurf(anwurf('2026-11-14'), anwurf('2026-11-14'))).toBe(
      0
    );
  });
});

describe('ergebnisVorlaeufig', () => {
  const KREISLIGA: Liga = {
    id: 54862,
    name: 'U12 Kreisliga',
    verband: { id: 7, name: 'Niedersachsen' },
    altersklasse: 'U12',
    geschlecht: 'mix',
    spielklasse: 'Kreisliga',
  };
  const BBL: Liga = {
    ...KREISLIGA,
    name: '1. Bundesliga (easyCredit BBL)',
    verband: { id: 100, name: 'Bundesligen' },
    ohneSpielberichte: true,
    confirmsNoResults: true,
  };
  const UNBESTAETIGT = spiel({
    status: {
      art: 'gespielt',
      ergebnis: { heim: 78, gast: 47 },
      bestaetigt: false,
    },
  });

  it.each([
    ['its Liga', KREISLIGA],
    ['a Liga the Saison does not list', undefined],
  ])(
    'holds for a played Spiel the Verband has not confirmed yet, with %s',
    (_case, liga) => {
      expect(ergebnisVorlaeufig(UNBESTAETIGT, liga)).toBe(true);
    }
  );

  it('does not hold in a Liga whose results the DBB never confirms', () => {
    expect(ergebnisVorlaeufig(UNBESTAETIGT, BBL)).toBe(false);
  });

  it.each([
    [
      'a confirmed result',
      { art: 'gespielt', ergebnis: { heim: 78, gast: 47 }, bestaetigt: true },
    ],
    ['a planned Spiel', { art: 'geplant' }],
    ['a cancelled Spiel', { art: 'abgesagt' }],
    [
      'a forfeit',
      {
        art: 'kampflos',
        verzichtet: ['gast'],
        ergebnis: { heim: 20, gast: 0 },
      },
    ],
  ] as const)('does not hold for %s', (_case, status) => {
    expect(ergebnisVorlaeufig(spiel({ status }), KREISLIGA)).toBe(false);
  });
});

describe('istEntschieden', () => {
  it.each([
    [
      { art: 'gespielt', ergebnis: { heim: 1, gast: 0 }, bestaetigt: true },
      true,
    ],
    [{ art: 'kampflos', verzichtet: [] }, true],
    [{ art: 'geplant' }, false],
    [{ art: 'abgesagt' }, false],
  ] as const)('%o: %s', (status, entschieden) => {
    expect(
      istEntschieden({
        id: 1,
        ligaId: 1,
        spieltag: 1,
        datum: '2026-11-14',
        heim: UNS,
        gast: GIFHORN,
        status,
      })
    ).toBe(entschieden);
  });
});

describe('ausgangVon', () => {
  const gespielt = (heim: number, gast: number): Spiel['status'] => ({
    art: 'gespielt',
    ergebnis: { heim, gast },
    bestaetigt: true,
  });

  it('tells a win from a loss from either side', () => {
    const spielMit = spiel({ status: gespielt(78, 47) });

    expect(ausgangVon(spielMit, 'heim')).toBe('sieg');
    expect(ausgangVon(spielMit, 'gast')).toBe('niederlage');
  });

  it('has none for equal points: basketball has no draws, so no result yet', () => {
    expect(
      ausgangVon(spiel({ status: gespielt(0, 0) }), 'heim')
    ).toBeUndefined();
    expect(
      ausgangVon(
        spiel({
          status: {
            art: 'kampflos',
            verzichtet: [],
            ergebnis: { heim: 0, gast: 0 },
          },
        }),
        'gast'
      )
    ).toBeUndefined();
  });

  it('reads a result the Verband has not confirmed yet, as its points show', () => {
    expect(
      ausgangVon(
        spiel({
          status: {
            art: 'gespielt',
            ergebnis: { heim: 78, gast: 47 },
            bestaetigt: false,
          },
        }),
        'heim'
      )
    ).toBe('sieg');
  });

  it('gives a forfeit to the side that did not forfeit', () => {
    const verzicht = spiel({
      status: { art: 'kampflos', verzichtet: ['gast'] },
    });

    expect(ausgangVon(verzicht, 'heim')).toBe('sieg');
    expect(ausgangVon(verzicht, 'gast')).toBe('niederlage');
  });

  it('counts a forfeit of both sides as a loss for each', () => {
    const beide = spiel({
      status: { art: 'kampflos', verzichtet: ['heim', 'gast'] },
    });

    expect(ausgangVon(beide, 'heim')).toBe('niederlage');
    expect(ausgangVon(beide, 'gast')).toBe('niederlage');
  });

  it('reads a forfeit naming no side by its points, where it has any', () => {
    expect(
      ausgangVon(
        spiel({
          status: {
            art: 'kampflos',
            verzichtet: [],
            ergebnis: { heim: 0, gast: 20 },
          },
        }),
        'gast'
      )
    ).toBe('sieg');
    expect(
      ausgangVon(spiel({ status: { art: 'kampflos', verzichtet: [] } }), 'heim')
    ).toBeUndefined();
  });

  it.each([{ art: 'geplant' }, { art: 'abgesagt' }] as const)(
    'has none while $art',
    (status) => {
      expect(ausgangVon(spiel({ status }), 'heim')).toBeUndefined();
    }
  );
});
