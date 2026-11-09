import type { Spiel } from './spiel';
import type { Team } from './team';
import type { TeamSaison } from './team-saison';
import {
  gemeinsamerUeberblick,
  nachNaechstemSpiel,
  teamUeberblick,
} from './team-ueberblick';

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
  return saisonVon(UNSER_TEAM, ...spiele);
}

function saisonVon(team: Team, ...spiele: Spiel[]): TeamSaison {
  return {
    team,
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
    expect(teamUeberblick(saison(), HEUTE)).toEqual({ ausfaelle: [] });
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

  it("counts today's Spiel as the last result once it has one, not as the next", () => {
    const ueberblick = teamUeberblick(
      saison(
        spiel(1, '2026-10-03', GESPIELT),
        spiel(2, HEUTE, GESPIELT),
        spiel(3, '2026-11-21')
      ),
      HEUTE
    );

    expect(ueberblick.letztes?.id).toBe(2);
    expect(ueberblick.naechstes?.id).toBe(3);
  });

  it('counts a forfeited Spiel as a result, and one to come as falling through', () => {
    const kampflos: Spiel['status'] = { art: 'kampflos', verzichtet: ['gast'] };

    const ueberblick = teamUeberblick(
      saison(
        spiel(1, '2026-10-03', kampflos),
        spiel(2, '2026-11-14', kampflos),
        spiel(3, '2026-11-21')
      ),
      HEUTE
    );

    expect(ueberblick.letztes?.id).toBe(1);
    expect(ueberblick.naechstes?.id).toBe(3);
    expect(ids(ueberblick.ausfaelle)).toEqual([2]);
  });

  it("shows today's forfeit as the last result only", () => {
    const kampflos: Spiel['status'] = { art: 'kampflos', verzichtet: ['gast'] };

    const ueberblick = teamUeberblick(
      saison(spiel(1, HEUTE, kampflos), spiel(2, '2026-11-21')),
      HEUTE
    );

    expect(ueberblick.letztes?.id).toBe(1);
    expect(ueberblick.ausfaelle).toEqual([]);
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
    expect(ids(ueberblick.ausfaelle)).toEqual([2]);
  });

  it('lists every Spiel to come that falls through where none takes place', () => {
    const ueberblick = teamUeberblick(
      saison(
        spiel(1, '2026-10-03', GESPIELT),
        spiel(2, '2026-11-14', { art: 'abgesagt' }),
        spiel(3, '2026-11-21', { art: 'kampflos', verzichtet: [] })
      ),
      HEUTE
    );

    expect(ueberblick.naechstes).toBeUndefined();
    expect(ids(ueberblick.ausfaelle)).toEqual([2, 3]);
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

describe('gemeinsamerUeberblick', () => {
  const U14: Team = { id: 313040, name: 'MTV Wasbüttel U14', vereinId: 1837 };

  function ueberblick(...saisons: TeamSaison[]) {
    const gemeinsam = gemeinsamerUeberblick(
      saisons.map((s) => ({ saison: s, ueberblick: teamUeberblick(s, HEUTE) }))
    );
    return {
      naechstes: gemeinsam.naechstes && [
        gemeinsam.naechstes.saison.team.id,
        gemeinsam.naechstes.spiel.id,
      ],
      ausfaelle: gemeinsam.ausfaelle.map(({ spiel }) => spiel.id),
      letztes: gemeinsam.letztes && [
        gemeinsam.letztes.saison.team.id,
        gemeinsam.letztes.spiel.id,
      ],
    };
  }

  it('has nothing for no Saison', () => {
    expect(ueberblick()).toEqual({ ausfaelle: [] });
  });

  it("takes the first next Spiel and the latest result of all Teams', each with its Saison", () => {
    expect(
      ueberblick(
        saison(spiel(1, '2026-11-01', GESPIELT), spiel(2, '2026-11-21')),
        saisonVon(
          U14,
          spiel(3, '2026-11-07', GESPIELT),
          spiel(4, '2026-11-14', { art: 'geplant' }, '18:00')
        )
      )
    ).toEqual({ naechstes: [U14.id, 4], ausfaelle: [], letztes: [U14.id, 3] });
  });

  it('orders by tip-off within a day, the first Saison winning a tie', () => {
    expect(
      ueberblick(
        saison(spiel(1, '2026-11-14', { art: 'geplant' }, '12:00')),
        saisonVon(U14, spiel(2, '2026-11-14', { art: 'geplant' }, '10:00'))
      ).naechstes
    ).toEqual([U14.id, 2]);
    expect(
      ueberblick(
        saison(spiel(1, '2026-11-14')),
        saisonVon(U14, spiel(2, '2026-11-14'))
      ).naechstes
    ).toEqual([UNSER_TEAM.id, 1]);
  });

  it("lists each Team's Spiele falling through, as its own overview does, by tip-off", () => {
    expect(
      ueberblick(
        saison(
          spiel(1, '2026-11-15', { art: 'abgesagt' }),
          spiel(2, '2026-11-29')
        ),
        saisonVon(
          U14,
          spiel(3, '2026-11-08', { art: 'abgesagt' }),
          spiel(4, '2026-11-21')
        )
      ).ausfaelle
    ).toEqual([3, 1]);
  });

  it("keeps a Team's cancelled Spiel on the day of another Team's next one, without a tip-off", () => {
    const gemeinsam = ueberblick(
      saison(spiel(1, '2026-11-14', { art: 'geplant' }, '12:00')),
      saisonVon(
        U14,
        { ...spiel(2, '2026-11-14', { art: 'abgesagt' }), uhrzeit: undefined },
        spiel(3, '2026-11-21')
      )
    );

    expect(gemeinsam.naechstes).toEqual([UNSER_TEAM.id, 1]);
    expect(gemeinsam.ausfaelle).toEqual([2]);
  });

  it("keeps a Team's cancelled Spiel after another Team's next one", () => {
    const gemeinsam = ueberblick(
      saison(spiel(1, '2026-11-14')),
      saisonVon(
        U14,
        spiel(2, '2026-11-21', { art: 'abgesagt' }),
        spiel(3, '2026-11-28')
      )
    );

    expect(gemeinsam.naechstes).toEqual([UNSER_TEAM.id, 1]);
    expect(gemeinsam.ausfaelle).toEqual([2]);
  });

  it('lists every Spiel falling through where none is next', () => {
    expect(
      ueberblick(
        saison(spiel(1, '2026-11-15', { art: 'abgesagt' })),
        saisonVon(U14, spiel(2, '2026-11-08', { art: 'abgesagt' }))
      ).ausfaelle
    ).toEqual([2, 1]);
  });
});
