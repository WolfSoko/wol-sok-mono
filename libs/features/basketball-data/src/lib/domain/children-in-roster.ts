import type { PersonId, TeamId } from './ids';
import { sideOf, type Game } from './game';
import {
  isNamed,
  type NamedPlayer,
  type Roster,
  type GameReport,
} from './game-report';

/**
 * The named players of `roster` whose person is one of `persons` (the
 * marked Kinder), in the Kader's order. An Anonymer Spieler is never one:
 * it has no person id (ADR 0019).
 */
export function childrenInRoster(
  roster: Roster,
  persons: readonly PersonId[]
): readonly NamedPlayer[] {
  return roster.entries.filter(
    (entry): entry is NamedPlayer =>
      isNamed(entry) && persons.includes(entry.personId)
  );
}

/**
 * The Kader of `team`'s side in `report`, the Spielbericht of `game`;
 * none where the Team plays on neither side. A Kind is looked for only
 * there, in a followed Team's own Kader (ADR 0019).
 */
export function rosterOfTeam(
  report: GameReport,
  game: Game,
  team: TeamId
): Roster | undefined {
  const side = sideOf(game, team);
  return side && report[side];
}
