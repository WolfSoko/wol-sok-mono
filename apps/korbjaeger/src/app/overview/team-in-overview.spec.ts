import { signal } from '@angular/core';
import type {
  RosterFinds,
  GameDetails,
  TeamSeason,
  TeamOverview,
  ClubId,
  ClubTeams,
} from '@wolsok/feat-shared-basketball-data';
import {
  FakeDataResource,
  type FakeReading,
} from '../basketball-data/testing/fake-data-resource';
import type { AsOf } from '../basketball-data/as-of';
import { UNREADABLE } from './roster-finds';
import { teamInOverview } from './team-in-overview';
import type { TeamReadings } from './team-readings';

const TEAM = 313036;
const CLUB: ClubId = 1837;

const SEASON: TeamSeason = {
  team: { id: TEAM, name: 'MTV Wasbüttel', clubId: CLUB },
  club: { id: CLUB, name: 'MTV Wasbüttel' },
  leagues: [],
  games: [],
};

const OVERVIEW: TeamOverview = { cancellations: [] };

const FUNDE: RosterFinds = {
  games: new Map([[3, new Map([[4711, 'Lumi']])]]),
  incomplete: false,
};

const ALT: AsOf = { storedAt: 1000, reason: 'no-internet' };
const OLDER: AsOf = { storedAt: 500, reason: 'unavailable' };

interface Readings {
  readonly season?: FakeReading<TeamSeason>;
  readonly searching?: boolean;
  readonly finds?: RosterFinds;
  readonly seasonOverClub?: ClubId;
}

/** A Team's reads as `readings` shows them; its Saison read, by default. */
function reading({
  season = { status: 'resolved', value: SEASON },
  searching = false,
  finds,
  seasonOverClub,
}: Readings = {}): TeamReadings {
  return {
    season: new FakeDataResource(season),
    overview: signal(season.value && OVERVIEW),
    nextDetails: new FakeDataResource<GameDetails>({ status: 'idle' }),
    rosterSearch: new FakeDataResource<RosterFinds>({ status: 'idle' }),
    searching: signal(searching),
    finds: signal(finds),
    seasonOverClub: signal(seasonOverClub),
  };
}

const noClubs = () => undefined;

describe('teamInOverview', () => {
  it('shows a Team just followed as loading, searched where a Kind is marked', () => {
    expect(teamInOverview(TEAM, undefined, noClubs, true)).toEqual({
      card: { kind: 'loading', teamId: TEAM },
      searching: true,
    });
    expect(teamInOverview(TEAM, undefined, noClubs, false).searching).toBe(
      false
    );
  });

  it('shows a Team whose Saison is still read as loading', () => {
    const loading = reading({ season: { status: 'loading' } });

    expect(teamInOverview(TEAM, loading, noClubs, false).card).toEqual({
      kind: 'loading',
      teamId: TEAM,
    });
  });

  it('ends the search of a Team whose Saison failed, unable to tell', () => {
    const failed = reading({
      season: { status: 'error', error: new Error('offline') },
    });

    const withChildren = teamInOverview(TEAM, failed, noClubs, true);
    const without = teamInOverview(TEAM, failed, noClubs, false);

    expect(withChildren.card.kind).toBe('error');
    expect(withChildren.finds).toBe(UNREADABLE);
    expect(withChildren.searching).toBe(false);
    expect(without.finds).toBeUndefined();
  });

  it('gives a read Team its card and Saison, and its finds only where a Kind is marked', () => {
    const read = reading({
      finds: FUNDE,
    });

    const withChildren = teamInOverview(TEAM, read, noClubs, true);
    const without = teamInOverview(TEAM, read, noClubs, false);

    expect(withChildren.card).toMatchObject({
      kind: 'loaded',
      teamId: TEAM,
      name: 'MTV Wasbüttel',
      seasonOver: false,
    });
    expect(withChildren.season).toEqual({
      season: SEASON,
      overview: OVERVIEW,
    });
    expect(withChildren.finds).toBe(FUNDE);
    expect(withChildren.searching).toBe(false);
    expect(without.finds).toBeUndefined();
    expect(without.searching).toBe(false);
  });

  it('says a Team is still searched while its search runs', () => {
    const suchend = reading({ searching: true });

    expect(teamInOverview(TEAM, suchend, noClubs, true).searching).toBe(true);
    expect(teamInOverview(TEAM, suchend, noClubs, false).searching).toBe(false);
  });

  it("reads its Verein's Teams only once its Saison looks over", () => {
    const clubTeamsOf = vi.fn(noClubs);

    teamInOverview(TEAM, reading(), clubTeamsOf, false);
    const beendet = teamInOverview(
      TEAM,
      reading({ seasonOverClub: CLUB }),
      clubTeamsOf,
      false
    );

    expect(clubTeamsOf).toHaveBeenCalledExactlyOnceWith(CLUB);
    expect(beendet.card).toMatchObject({ seasonOver: true });
  });

  it("dates the card by its Verein's Teams too, the Team itself by its own reads", () => {
    const clubTeams = new FakeDataResource<ClubTeams>({
      status: 'resolved',
      value: { club: SEASON.club, teams: [] },
      asOf: OLDER,
    });

    const team = teamInOverview(
      TEAM,
      reading({
        season: { status: 'resolved', value: SEASON, asOf: ALT },
        seasonOverClub: CLUB,
      }),
      () => clubTeams,
      false
    );

    expect(team.card).toMatchObject({ asOf: OLDER });
    expect(team.asOf).toBe(ALT);
  });
});
