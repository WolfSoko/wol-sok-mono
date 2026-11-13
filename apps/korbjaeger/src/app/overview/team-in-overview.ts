import type {
  TeamId,
  ClubId,
  ClubTeams,
} from '@wolsok/feat-shared-basketball-data';
import type { DataResource } from '../basketball-data/basketball-data-resource';
import { oldestAsOf } from '../basketball-data/as-of';
import { venueState } from '../venue/venue-state';
import { clubTeamsState } from '../club/club-teams-state';
import { UNREADABLE } from './roster-finds';
import { errorCard, loadedCard } from './team-card';
import type { TeamReadings } from './team-readings';
import type { TeamInOverview } from './overview-view';

/**
 * `teamId` as the overview holds it, from its reads (`reading`, none yet
 * while it was just followed) and, where its Saison looks over, the read
 * of its Verein's Teams (`clubTeamsOf`); `withChildren` where a Kind is
 * marked, so its Kader is searched. A Team whose Saison failed ends its
 * search there, unable to tell (`incomplete`).
 */
export function teamInOverview(
  teamId: TeamId,
  reading: TeamReadings | undefined,
  clubTeamsOf: (
    club: ClubId
  ) => DataResource<ClubTeams | undefined> | undefined,
  withChildren: boolean
): TeamInOverview {
  const season = reading?.season;
  if (season?.status() === 'error') {
    return {
      card: errorCard(teamId, season.error()),
      ...(withChildren && { finds: UNREADABLE }),
      searching: false,
    };
  }
  const overview = reading?.overview();
  if (!reading || !season?.hasValue() || overview === undefined) {
    return { card: { kind: 'loading', teamId }, searching: withChildren };
  }
  const club = reading.seasonOverClub();
  const clubTeams = club === undefined ? undefined : clubTeamsOf(club);
  const venue = venueState(reading.nextDetails);
  const asOf = oldestAsOf(season.asOf(), reading.nextDetails.asOf());
  const card = loadedCard(season.value(), overview, {
    // the oldest of what the card shows
    asOf: oldestAsOf(asOf, clubTeams?.asOf()),
    venue,
    seasonOver: club !== undefined,
    clubTeams: clubTeams && clubTeamsState(clubTeams, teamId),
  });
  const finds = withChildren ? reading.finds() : undefined;
  return {
    card,
    season: { season: season.value(), overview },
    venue,
    asOf,
    ...(finds && { finds }),
    searching: withChildren && reading.searching(),
  };
}
