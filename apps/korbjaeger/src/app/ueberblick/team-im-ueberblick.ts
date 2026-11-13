import type {
  TeamId,
  ClubId,
  ClubTeams,
} from '@wolsok/feat-shared-basketball-data';
import type { DataResource } from '../basketball-data/basketball-data-resource';
import { oldestAsOf } from '../basketball-data/as-of';
import { venueState } from '../venue/venue-state';
import { vereinsTeamsStand } from '../verein/vereins-teams-stand';
import { NICHT_LESBAR } from './kader-funde';
import { fehlerKarte, geladeneKarte } from './team-karte';
import type { TeamLesungen } from './team-lesungen';
import type { TeamImUeberblick } from './ueberblick-ansicht';

/**
 * `teamId` as the overview holds it, from its reads (`lesung`, none yet
 * while it was just followed) and, where its Saison looks over, the read
 * of its Verein's Teams (`vereinsTeamsVon`); `mitKindern` where a Kind is
 * marked, so its Kader is searched. A Team whose Saison failed ends its
 * search there, unable to tell (`unvollstaendig`).
 */
export function teamImUeberblick(
  teamId: TeamId,
  lesung: TeamLesungen | undefined,
  vereinsTeamsVon: (
    verein: ClubId
  ) => DataResource<ClubTeams | undefined> | undefined,
  mitKindern: boolean
): TeamImUeberblick {
  const saison = lesung?.saison;
  if (saison?.status() === 'error') {
    return {
      karte: fehlerKarte(teamId, saison.error()),
      ...(mitKindern && { funde: NICHT_LESBAR }),
      sucht: false,
    };
  }
  const ueberblick = lesung?.ueberblick();
  if (!lesung || !saison?.hasValue() || ueberblick === undefined) {
    return { karte: { art: 'laedt', teamId }, sucht: mitKindern };
  }
  const verein = lesung.saisonEndeVerein();
  const vereinsTeams =
    verein === undefined ? undefined : vereinsTeamsVon(verein);
  const halle = venueState(lesung.naechsteDetails);
  const stand = oldestAsOf(saison.asOf(), lesung.naechsteDetails.asOf());
  const karte = geladeneKarte(saison.value(), ueberblick, {
    // the oldest of what the card shows
    stand: oldestAsOf(stand, vereinsTeams?.asOf()),
    halle,
    saisonBeendet: verein !== undefined,
    vereinsTeams: vereinsTeams && vereinsTeamsStand(vereinsTeams, teamId),
  });
  const funde = mitKindern ? lesung.funde() : undefined;
  return {
    karte,
    saison: { season: saison.value(), overview: ueberblick },
    halle,
    stand,
    ...(funde && { funde }),
    sucht: mitKindern && lesung.sucht(),
  };
}
