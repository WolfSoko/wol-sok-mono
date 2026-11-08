import type { SpielPartei } from './partei';
import {
  datumInDeutschland,
  ergebnisVon,
  gegnerVon,
  seiteVon,
  sonderfallVon,
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
