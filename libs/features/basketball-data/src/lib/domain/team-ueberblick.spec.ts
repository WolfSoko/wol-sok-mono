import type { Spiel } from './spiel';
import type { Team } from './team';
import type { TeamSaison } from './team-saison';
import { nachNaechstemSpiel, teamUeberblick } from './team-ueberblick';

const UNSER_TEAM: Team = { id: 313036, name: 'MTV Wasbüttel', vereinId: 1837 };

const GESPIELT: Spiel['status'] = {
  art: 'gespielt',
  ergebnis: { heim: 78, gast: 47 },
  bestaetigt: true,
};

function spiel(
  id: number,
  datum: string,
  status: Spiel['status'] = { art: 'geplant' },
  uhrzeit: string | undefined = '10:00'
): Spiel {
  return {
    id,
    ligaId: 54862,
    datum,
    uhrzeit,
    spieltag: 1,
    heim: { art: 'team', team: UNSER_TEAM },
    gast: { art: 'offen', bezeichnung: 'Gegner' },
    status,
  };
}

/** A Saison with `spiele`, in date order as the port gives them. */
function saison(...spiele: Spiel[]): TeamSaison {
  return {
    team: UNSER_TEAM,
    verein: { id: 1837, name: 'MTV Wasbüttel' },
    ligen: [],
    spiele,
  };
}

function ids(spiele: readonly Spiel[]): readonly number[] {
  return spiele.map(({ id }) => id);
}

const HEUTE = '2026-11-08';

describe('teamUeberblick', () => {
  it('has neither a next Spiel nor a result for a Team without Spiele', () => {
    expect(teamUeberblick(saison(), HEUTE)).toEqual({ abgesagt: [] });
  });

  it('has the next Spiel and the last result around today', () => {
    const ueberblick = teamUeberblick(
      saison(
        spiel(1, '2026-10-03', GESPIELT),
        spiel(2, '2026-10-17', GESPIELT),
        spiel(3, '2026-11-21'),
        spiel(4, '2026-12-05')
      ),
      HEUTE
    );

    expect(ueberblick.naechstes?.id).toBe(3);
    expect(ueberblick.letztes?.id).toBe(2);
  });

  it('has only the last result once no Spiel is left', () => {
    const ueberblick = teamUeberblick(
      saison(spiel(1, '2026-10-03', GESPIELT)),
      HEUTE
    );

    expect(ueberblick.naechstes).toBeUndefined();
    expect(ueberblick.letztes?.id).toBe(1);
  });

  it('passes over a past Spiel still waiting for its result', () => {
    const ueberblick = teamUeberblick(
      saison(spiel(1, '2026-10-03', GESPIELT), spiel(2, '2026-10-17')),
      HEUTE
    );

    expect(ueberblick.letztes?.id).toBe(1);
  });

  it("counts today's Spiel as the last result once it has one", () => {
    const ueberblick = teamUeberblick(
      saison(spiel(1, '2026-10-03', GESPIELT), spiel(2, HEUTE, GESPIELT)),
      HEUTE
    );

    expect(ueberblick.letztes?.id).toBe(2);
  });

  it('counts a forfeited Spiel as a result and as the next Spiel', () => {
    const kampflos: Spiel['status'] = { art: 'kampflos', verzichtet: ['gast'] };

    const ueberblick = teamUeberblick(
      saison(
        spiel(1, '2026-10-03', kampflos),
        spiel(2, '2026-11-21', kampflos)
      ),
      HEUTE
    );

    expect(ueberblick.letztes?.id).toBe(1);
    expect(ueberblick.naechstes?.id).toBe(2);
  });

  it('lists the cancelled Spiele before the next one, which it passes over', () => {
    const abgesagt: Spiel['status'] = { art: 'abgesagt' };

    const ueberblick = teamUeberblick(
      saison(
        spiel(1, '2026-10-03', abgesagt),
        spiel(2, '2026-11-14', abgesagt),
        spiel(3, '2026-11-21'),
        spiel(4, '2026-12-05', abgesagt)
      ),
      HEUTE
    );

    expect(ueberblick.naechstes?.id).toBe(3);
    expect(ids(ueberblick.abgesagt)).toEqual([2]);
  });

  it('lists every cancelled Spiel to come where none takes place', () => {
    const abgesagt: Spiel['status'] = { art: 'abgesagt' };

    const ueberblick = teamUeberblick(
      saison(
        spiel(1, '2026-10-03', GESPIELT),
        spiel(2, '2026-11-14', abgesagt),
        spiel(3, '2026-11-21', abgesagt)
      ),
      HEUTE
    );

    expect(ueberblick.naechstes).toBeUndefined();
    expect(ids(ueberblick.abgesagt)).toEqual([2, 3]);
    expect(ueberblick.letztes?.id).toBe(1);
  });
});

describe('nachNaechstemSpiel', () => {
  interface Eintrag {
    readonly name: string;
    readonly naechstes?: Spiel;
  }

  function namen(eintraege: readonly Eintrag[]): readonly string[] {
    return eintraege.map(({ name }) => name);
  }

  function sortiert(...eintraege: Eintrag[]): readonly string[] {
    return namen(nachNaechstemSpiel(eintraege, ({ naechstes }) => naechstes));
  }

  it('puts the Team that plays first first', () => {
    expect(
      sortiert(
        { name: 'später', naechstes: spiel(1, '2026-11-21') },
        { name: 'bald', naechstes: spiel(2, '2026-11-14') }
      )
    ).toEqual(['bald', 'später']);
  });

  it('orders a shared day by tip-off, a Spiel without one last', () => {
    expect(
      sortiert(
        {
          name: 'ohne Uhrzeit',
          naechstes: { ...spiel(1, '2026-11-14'), uhrzeit: undefined },
        },
        {
          name: 'nachmittags',
          naechstes: spiel(2, '2026-11-14', undefined, '15:00'),
        },
        {
          name: 'morgens',
          naechstes: spiel(3, '2026-11-14', undefined, '09:30'),
        }
      )
    ).toEqual(['morgens', 'nachmittags', 'ohne Uhrzeit']);
  });

  it('puts Teams without a next Spiel last, in the order given', () => {
    expect(
      sortiert(
        { name: 'fertig A' },
        { name: 'spielt', naechstes: spiel(1, '2026-11-21') },
        { name: 'fertig B' }
      )
    ).toEqual(['spielt', 'fertig A', 'fertig B']);
  });

  it('keeps the order given where the next Spiele start together', () => {
    expect(
      sortiert(
        { name: 'erst gefolgt', naechstes: spiel(1, '2026-11-21') },
        { name: 'dann gefolgt', naechstes: spiel(2, '2026-11-21') }
      )
    ).toEqual(['erst gefolgt', 'dann gefolgt']);
  });

  it('leaves the list it was given alone', () => {
    const eintraege: Eintrag[] = [
      { name: 'später', naechstes: spiel(1, '2026-11-21') },
      { name: 'bald', naechstes: spiel(2, '2026-11-14') },
    ];

    nachNaechstemSpiel(eintraege, ({ naechstes }) => naechstes);

    expect(namen(eintraege)).toEqual(['später', 'bald']);
  });
});
