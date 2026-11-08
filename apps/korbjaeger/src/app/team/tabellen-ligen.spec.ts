import type {
  Liga,
  Spiel,
  Team,
  TeamSaison,
} from '@wolsok/feat-shared-basketball-data';
import { tabellenLigen } from './tabellen-ligen';

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

function spiel(id: number, ligaId: number, datum: string): Spiel {
  return {
    id,
    ligaId,
    datum,
    spieltag: 1,
    heim: { art: 'team', team: UNSER_TEAM },
    gast: { art: 'offen', bezeichnung: 'Gegner' },
    status: { art: 'geplant' },
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

describe('tabellenLigen', () => {
  it('has no Liga for a Team without Spiele', () => {
    expect(tabellenLigen(saison(), '2026-11-08')).toEqual([]);
  });

  it('lists the one Liga a Team plays in', () => {
    expect(
      namen(
        tabellenLigen(saison(spiel(1, VORRUNDE.id, '2026-09-12')), '2026-11-08')
      )
    ).toEqual([VORRUNDE.name]);
  });

  it('puts the Liga of the next Spiel first: a Hauptrunde after its Vorrunde', () => {
    const ligen = tabellenLigen(
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
    const ligen = tabellenLigen(
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
    const ligen = tabellenLigen(
      saison(
        spiel(1, VORRUNDE.id, '2026-11-01'),
        spiel(2, HAUPTRUNDE.id, '2026-11-08')
      ),
      '2026-11-08'
    );

    expect(namen(ligen)[0]).toBe(HAUPTRUNDE.name);
  });

  it('puts the Liga of the last Spiel first once the Saison is over', () => {
    const ligen = tabellenLigen(
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
    const ligen = tabellenLigen(
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
});
