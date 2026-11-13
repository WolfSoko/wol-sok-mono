import {
  combinedOverview,
  byNextGame,
  lastPlayed,
  type RosterFinds,
  type PersonId,
  type SeasonWithOverview,
  type SeasonGame,
  type Game,
} from '@wolsok/feat-shared-basketball-data';
import type { Child } from '@wolsok/feat-korbjaeger-selection';
import { oldestAsOf, type AsOf } from '../basketball-data/as-of';
import type { VenueState } from '../venue/venue-state';
import { gameRow, type GameRow } from '../game/game-row';
import { cardName, type TeamCard } from './team-card';

/** A followed Team as the overview holds it: its card and its reads. */
export interface TeamInOverview {
  readonly card: TeamCard;
  /** Its Saison with its overview (`teamOverview`), once read. */
  readonly season?: SeasonWithOverview;
  /** The read of its next Spiel's Halle, once it started. */
  readonly venue?: VenueState;
  /** The oldest Stand of its Saison and next Spiel. */
  readonly asOf?: AsOf;
  /**
   * What its Kader told of the marked Kinder, the last finds kept while it
   * is searched again; none before the first search ended.
   */
  readonly finds?: RosterFinds;
  /** Whether its Kader is still searched, its Saison read before. */
  readonly searching: boolean;
}

/** What the overview shows of a Kind no Team's Kader named. */
export type NotFound =
  /** Not on any followed Team's Kader of its last played Spiele. */
  | 'not-in-roster'
  /**
   * A Team's Spiele or Spielberichte could not all be read, so the Kind
   * may be on a Kader unread.
   */
  | 'unreadable';

/** A Team of a Kind's card, with the name the card shows (`cardName`). */
export type ChildTeam = TeamCard & { readonly name: string };

/** One marked Kind on the overview, across the followed Teams it plays for. */
export interface ChildSection {
  readonly personId: PersonId;
  /** The Spitzname, else the first name its Kader gives, else "Mein Kind". */
  readonly title: string;
  /** The cards of the Teams whose Kader named the Kind, as followed. */
  readonly teams: readonly ChildTeam[];
  /** Whether a Team's Kader is still read, which may add a Team. */
  readonly searching: boolean;
  /** The first next Spiel of its Teams, by which the overview orders them. */
  readonly nextGame?: Game;
  readonly next?: GameRow;
  /** The heading of `next`, naming its Team where the Kind has several. */
  readonly nextTitle: string;
  /** The read of that Spiel's Halle. */
  readonly venue?: VenueState;
  /** What falls through before `next` (all of it where none is next). */
  readonly cancellations: readonly GameRow[];
  /** What falls through after `next`, shown below it. */
  readonly laterCancellations: readonly GameRow[];
  /** The latest result of its Teams. */
  readonly last?: GameRow;
  /** The heading of `last`, naming its Team where the Kind has several. */
  readonly lastTitle: string;
  /**
   * Whether the Kind was on the Kader of `last`; none where no
   * Spielbericht tells (none yet, not read, a forfeit).
   */
  readonly inRoster?: boolean;
  /** The oldest Stand of its Teams' reads. */
  readonly asOf?: AsOf;
  /** Why it shows no Team, once no Kader is still read. */
  readonly notFound?: NotFound;
  /**
   * Whether another Team's Spiele or Spielberichte could not all be read,
   * so the Kind may play for more Teams than it shows.
   */
  readonly maybeMoreTeams: boolean;
}

/** What the overview tells an Elternteil who marked no Kind yet. */
export type ChildHint =
  /** No followed Team has played: a Kind is in no Spielbericht yet. */
  | 'after-first-game'
  /** A Team has played: its Spiel page lets the Elternteil mark them. */
  | 'open-game';

/** The overview: the Kinder, the Teams without one, and a hint. */
export interface OverviewView {
  /** Each marked Kind, the one that plays first first, then as marked. */
  readonly children: readonly ChildSection[];
  /**
   * The followed Teams whose Kader named no Kind (all of them while none
   * is marked), the one that plays first first; a Team whose Kader is
   * still read shows here until a Kind is found in it.
   */
  readonly teams: readonly TeamCard[];
  readonly hint?: ChildHint;
}

/** What the overview calls a Kind with neither Spitzname nor a Kader yet. */
export const MY_CHILD = 'Mein Kind';

/**
 * The overview of `teams` for `children`, on `today`: each Kind with the
 * Teams whose Kader named it, the other Teams, and the hint while no Kind
 * is marked. Without a followed Team it is empty, Kinder or not: no Kader
 * can name them.
 *
 * @param today a German calendar day, `YYYY-MM-DD` (`dateInGermany`)
 */
export function overviewView(
  children: readonly Child[],
  teams: readonly TeamInOverview[],
  today: string
): OverviewView {
  if (teams.length === 0) {
    return { children: [], teams: [] };
  }
  if (children.length === 0) {
    const hint = childHint(teams, today);
    return { children: [], teams: afterGame(teams), ...(hint && { hint }) };
  }
  const sections = children.map((child) => childSection(child, teams));
  return {
    children: byNextGame(sections, (a) => a.nextGame),
    teams: afterGame(teams.filter((team) => withoutChild(team, children))),
  };
}

function childSection(
  child: Child,
  teams: readonly TeamInOverview[]
): ChildSection {
  const own = teams.filter(
    (team) => firstName(team, child.personId) !== undefined
  );
  const searching = teams.some((team) => team.searching);
  const { next, cancellations, laterCancellations, last } = combinedOverview(
    own.flatMap(({ season }) => (season ? [season] : []))
  );
  const ofTeam = (game: SeasonGame | undefined) =>
    game && own.find(({ season }) => season?.season === game.season);
  const inRoster = last && inRosterOf(ofTeam(last), last.game, child);
  const nichtGefunden =
    own.length === 0 && !searching ? whyNot(teams) : undefined;
  // a Kind with several Teams: which of them plays
  const title = (text: string, game: SeasonGame | undefined) =>
    game && own.length > 1 ? `${text} · ${game.season.team.name}` : text;
  return {
    personId: child.personId,
    title:
      child.nickname ??
      own.map((team) => firstName(team, child.personId)).find(Boolean) ??
      MY_CHILD,
    teams: own.map(({ card }) => ({ ...card, name: cardName(card) })),
    searching,
    cancellations: cancellations.map(row),
    laterCancellations: laterCancellations.map(row),
    nextTitle: title('Nächstes Spiel', next),
    lastTitle: title('Letztes Ergebnis', last),
    ...(next && {
      nextGame: next.game,
      next: row(next),
      venue: ofTeam(next)?.venue,
    }),
    ...(last && { last: row(last) }),
    ...(inRoster !== undefined && { inRoster }),
    asOf: oldestAsOf(...own.map(({ asOf }) => asOf)),
    ...(nichtGefunden && { notFound: nichtGefunden }),
    maybeMoreTeams:
      own.length > 0 &&
      teams.some(
        (team) => !own.includes(team) && team.finds?.incomplete === true
      ),
  };
}

function row({ season, game }: SeasonGame): GameRow {
  return gameRow(season, game);
}

/** The first name the Team's Kader gave the Kind `person`, if it named them. */
function firstName(team: TeamInOverview, person: PersonId): string | undefined {
  for (const children of team.finds?.games.values() ?? []) {
    const name = children?.get(person);
    if (name !== undefined) {
      return name;
    }
  }
  return undefined;
}

/** Whether `child` was on `team`'s Kader of `game`, where it was read. */
function inRosterOf(
  team: TeamInOverview | undefined,
  game: Game,
  child: Child
): boolean | undefined {
  return team?.finds?.games.get(game.id)?.has(child.personId);
}

function whyNot(teams: readonly TeamInOverview[]): NotFound {
  return teams.some(({ finds }) => finds?.incomplete)
    ? 'unreadable'
    : 'not-in-roster';
}

/**
 * Whether `team`'s Kader named none of `children` so far (or its Saison
 * failed): a Team whose search still runs shows among the others until a
 * Kind is found in it.
 */
function withoutChild(
  team: TeamInOverview,
  children: readonly Child[]
): boolean {
  return (
    team.card.kind === 'error' ||
    children.every(({ personId }) => firstName(team, personId) === undefined)
  );
}

function afterGame(teams: readonly TeamInOverview[]): readonly TeamCard[] {
  return byNextGame(
    teams.map(({ card }) => card),
    (card) => (card.kind === 'loaded' ? card.nextGame : undefined)
  );
}

/**
 * The hint while no Kind is marked: once every Saison is read (failed ones
 * aside), `spiel-oeffnen` where a Team played, else `nach-erstem-spiel`;
 * none while no Team is followed or a Saison is still read.
 */
function childHint(
  teams: readonly TeamInOverview[],
  today: string
): ChildHint | undefined {
  const seasons = teams
    .filter(({ card }) => card.kind !== 'error')
    .map(({ season }) => season?.season);
  if (seasons.length === 0) {
    return undefined;
  }
  if (seasons.some((s) => s && lastPlayed(s, today, 1).length > 0)) {
    return 'open-game';
  }
  return seasons.every((s) => s !== undefined) ? 'after-first-game' : undefined;
}
