import type { Liga } from './liga';
import type { Spiel } from './spiel';
import type { Team } from './team';
import {
  ligaVon,
  ligenAktuellZuerst,
  naechstesSpiel,
  type TeamSaison,
} from './team-saison';

const UNSER_TEAM: Team = { id: 313036, name: 'MTV Wasbüttel', vereinId: 1837 };

function liga(id: number, name: string): Liga {
  return {
    id,
    name,
    verband: { id: 7, name: 'Niedersachsen' },
    altersklasse: 'U12',
    geschlecht: 'mix',
    spielklasse: 'Kreisliga',
  };
}

const TESTSPIELE = liga(54689, 'Testspiele Braunschweig u12');
const VORRUNDE = liga(54862, 'Regionsvorrunde Nord');
const HAUPTRUNDE = liga(54900, 'Regionsliga');

function spiel(
  id: number,
  ligaId: number,
  datum: string,
  status: Spiel['status'] = { art: 'geplant' }
): Spiel {
  return {
    id,
    ligaId,
    datum,
    spieltag: 1,
    heim: { art: 'team', team: UNSER_TEAM },
    gast: { art: 'offen', bezeichnung: 'Gegner' },
    status,
  };
}

/** A Saison with `spiele`, in date order as the port gives them. */
function saison(...spiele: Spiel[]): TeamSaison {
  const ligen = [TESTSPIELE, VORRUNDE, HAUPTRUNDE].filter((l) =>
    spiele.some((s) => s.ligaId === l.id)
  );
  return {
    team: UNSER_TEAM,
    verein: { id: 1837, name: 'MTV Wasbüttel' },
    ligen,
    spiele,
  };
}

function namen(ligen: readonly Liga[]): readonly string[] {
  return ligen.map((l) => l.name);
}

describe('ligenAktuellZuerst', () => {
  it('has no Liga for a Team without Spiele', () => {
    expect(ligenAktuellZuerst(saison(), '2026-11-08')).toEqual([]);
  });

  it('lists the one Liga a Team plays in', () => {
    expect(
      namen(
        ligenAktuellZuerst(
          saison(spiel(1, VORRUNDE.id, '2026-09-12')),
          '2026-11-08'
        )
      )
    ).toEqual([VORRUNDE.name]);
  });

  it('puts the Liga of the next Spiel first: a Hauptrunde after its Vorrunde', () => {
    const ligen = ligenAktuellZuerst(
      saison(
        spiel(1, VORRUNDE.id, '2026-09-12'),
        spiel(2, VORRUNDE.id, '2026-11-01'),
        spiel(3, HAUPTRUNDE.id, '2026-11-21')
      ),
      '2026-11-08'
    );

    expect(namen(ligen)).toEqual([HAUPTRUNDE.name, VORRUNDE.name]);
  });

  it('keeps a Vorrunde first while it still has a Spiel to come', () => {
    const ligen = ligenAktuellZuerst(
      saison(
        spiel(1, VORRUNDE.id, '2026-09-12'),
        spiel(2, VORRUNDE.id, '2026-11-15'),
        spiel(3, HAUPTRUNDE.id, '2027-01-16')
      ),
      '2026-11-08'
    );

    expect(namen(ligen)).toEqual([VORRUNDE.name, HAUPTRUNDE.name]);
  });

  it('counts a Spiel of today as the next one', () => {
    const ligen = ligenAktuellZuerst(
      saison(
        spiel(1, VORRUNDE.id, '2026-11-01'),
        spiel(2, HAUPTRUNDE.id, '2026-11-08')
      ),
      '2026-11-08'
    );

    expect(namen(ligen)[0]).toBe(HAUPTRUNDE.name);
  });

  it('puts the Liga of the last Spiel first once the Saison is over', () => {
    const ligen = ligenAktuellZuerst(
      saison(
        spiel(1, TESTSPIELE.id, '2026-08-29'),
        spiel(2, VORRUNDE.id, '2026-09-12'),
        spiel(3, VORRUNDE.id, '2026-11-08')
      ),
      '2027-06-01'
    );

    expect(namen(ligen)).toEqual([VORRUNDE.name, TESTSPIELE.name]);
  });

  it('lists the other Ligen by their last Spiel, newest first', () => {
    const ligen = ligenAktuellZuerst(
      saison(
        spiel(1, VORRUNDE.id, '2026-09-12'),
        spiel(2, TESTSPIELE.id, '2026-10-03'),
        spiel(3, VORRUNDE.id, '2026-10-10'),
        spiel(4, HAUPTRUNDE.id, '2026-11-21')
      ),
      '2026-11-08'
    );

    expect(namen(ligen)).toEqual([
      HAUPTRUNDE.name,
      VORRUNDE.name,
      TESTSPIELE.name,
    ]);
  });
  it('passes over a cancelled Spiel when looking for the next one', () => {
    const ligen = ligenAktuellZuerst(
      saison(
        spiel(1, VORRUNDE.id, '2026-11-01'),
        spiel(2, HAUPTRUNDE.id, '2026-11-10', { art: 'abgesagt' }),
        spiel(3, VORRUNDE.id, '2026-11-15')
      ),
      '2026-11-08'
    );

    expect(namen(ligen)[0]).toBe(VORRUNDE.name);
  });

  it('passes over a cancelled last Spiel once the Saison is over', () => {
    const ligen = ligenAktuellZuerst(
      saison(
        spiel(1, VORRUNDE.id, '2026-11-01'),
        spiel(2, TESTSPIELE.id, '2026-11-20', { art: 'abgesagt' })
      ),
      '2027-06-01'
    );

    expect(namen(ligen)[0]).toBe(VORRUNDE.name);
  });

  it('counts a forfeited Spiel, whose result counts in its Liga', () => {
    const ligen = ligenAktuellZuerst(
      saison(
        spiel(1, VORRUNDE.id, '2026-11-01'),
        spiel(2, HAUPTRUNDE.id, '2026-11-10', {
          art: 'kampflos',
          verzichtet: ['gast'],
        }),
        spiel(3, VORRUNDE.id, '2026-11-15')
      ),
      '2026-11-08'
    );

    expect(namen(ligen)[0]).toBe(HAUPTRUNDE.name);
  });

  it("keeps today's Liga first on match day, once the Spiel is played", () => {
    const ligen = ligenAktuellZuerst(
      saison(
        spiel(1, VORRUNDE.id, '2026-11-08', {
          art: 'gespielt',
          ergebnis: { heim: 58, gast: 67 },
          bestaetigt: false,
        }),
        spiel(2, HAUPTRUNDE.id, '2026-11-21')
      ),
      '2026-11-08'
    );

    expect(namen(ligen)[0]).toBe(VORRUNDE.name);
  });

  it('still names a Liga whose Spiele are all cancelled', () => {
    const ligen = ligenAktuellZuerst(
      saison(spiel(1, VORRUNDE.id, '2026-11-15', { art: 'abgesagt' })),
      '2026-11-08'
    );

    expect(namen(ligen)).toEqual([VORRUNDE.name]);
  });
});

describe('naechstesSpiel', () => {
  it("is the first Spiel from today on, today's included", () => {
    const heute = spiel(2, VORRUNDE.id, '2026-11-08');

    expect(
      naechstesSpiel(
        saison(spiel(1, VORRUNDE.id, '2026-11-01'), heute),
        '2026-11-08'
      )
    ).toBe(heute);
  });

  it('passes over a cancelled Spiel and a forfeited one, neither played', () => {
    const geplant = spiel(4, VORRUNDE.id, '2026-11-21');

    expect(
      naechstesSpiel(
        saison(
          spiel(2, VORRUNDE.id, '2026-11-10', { art: 'abgesagt' }),
          spiel(3, VORRUNDE.id, '2026-11-15', {
            art: 'kampflos',
            verzichtet: [],
          }),
          spiel(5, VORRUNDE.id, '2026-11-16', {
            art: 'kampflos',
            verzichtet: ['gast'],
            ergebnis: { heim: 20, gast: 0 },
          }),
          geplant
        ),
        '2026-11-08'
      )
    ).toBe(geplant);
  });

  it("passes over today's Spiel once it has its result", () => {
    const morgen = spiel(3, VORRUNDE.id, '2026-11-09');

    expect(
      naechstesSpiel(
        saison(
          spiel(2, VORRUNDE.id, '2026-11-08', {
            art: 'gespielt',
            ergebnis: { heim: 58, gast: 67 },
            bestaetigt: false,
          }),
          morgen
        ),
        '2026-11-08'
      )
    ).toBe(morgen);
  });

  it('is none once the Saison is over', () => {
    expect(
      naechstesSpiel(saison(spiel(1, VORRUNDE.id, '2026-11-01')), '2026-11-08')
    ).toBeUndefined();
  });
});

describe('ligaVon', () => {
  it('finds a Liga of the Saison by its id', () => {
    const zweiLigen = saison(
      spiel(1, TESTSPIELE.id, '2026-08-29'),
      spiel(2, VORRUNDE.id, '2026-09-12')
    );

    expect(ligaVon(zweiLigen, VORRUNDE.id)).toBe(VORRUNDE);
    expect(ligaVon(zweiLigen, HAUPTRUNDE.id)).toBeUndefined();
  });
});
