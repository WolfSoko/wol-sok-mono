import type {
  PersonId,
  TeamId,
  ClubId,
} from '@wolsok/feat-shared-basketball-data';
import type { ReadDocument, TeamPlace } from './selection-document';
import {
  SELECTION_LIMITS,
  SELECTION_LISTS,
  everyList,
  EMPTY_SELECTION,
  listWithout,
  sinceOf,
  withEntryAt,
  type SelectionContent,
  type SelectionLists,
} from './selection-lists';
import { sameColors, clubColorsOf, type ClubColors } from './club-colors';
import { byClub, type ClubColorsChoice } from './club-colors-choice';
import { SelectionFullError } from './selection-errors';
import { childWith, type MarkablePlayer } from './child';

/**
 * A change of a `Selection`, as every adapter applies it to what it read:
 * the same `content` back where it changes nothing, so an adapter can tell
 * that nothing is to be stored.
 */
export type SelectionChange = (content: SelectionContent) => SelectionContent;

/**
 * Follows `team`, unless it is followed: at `place`, its old place, else at
 * the end of Meine Teams, where the write gives it a new `since`
 * (`withEntryAt`).
 */
export function followChange(team: TeamId, place?: TeamPlace): SelectionChange {
  return (content) =>
    content.teams.includes(team)
      ? content
      : withEntryAt('teams', content, team, place?.since);
}

/** Unfollows `team`, if it is followed. */
export function unfollowChange(team: TeamId): SelectionChange {
  return (content) =>
    content.teams.includes(team)
      ? { ...content, teams: content.teams.filter((id) => id !== team) }
      : content;
}

/**
 * The place `team` has in `content`; none where it is not followed, or its
 * `since` is not known yet.
 */
export function teamPlace(
  content: SelectionContent,
  team: TeamId
): TeamPlace | undefined {
  const since = sinceOf('teams', content, team);
  return since === undefined ? undefined : { since };
}

/**
 * Marks `player` with `nickname`, at the end, where the write gives it a
 * new `since`, unless marked already.
 */
export function markChange(
  player: MarkablePlayer,
  nickname?: string
): SelectionChange {
  return (content) =>
    isMarked(content, player.personId)
      ? content
      : withEntryAt('children', content, childWith(player.personId, nickname));
}

/** Gives the Kind `person` the Spitzname `nickname`, if it is marked. */
export function nicknameChange(
  person: PersonId,
  nickname: string | undefined
): SelectionChange {
  const updated = childWith(person, nickname);
  return (content) =>
    content.children.some(
      (child) =>
        child.personId === person && child.nickname !== updated.nickname
    )
      ? {
          ...content,
          children: content.children.map((child) =>
            child.personId === person ? updated : child
          ),
        }
      : content;
}

/**
 * Sets the colours of `club` to `colors` (as stored: `clubColorsOf`,
 * which throws `NotAColorError` for what is no colour), in place of any
 * it has.
 */
export function clubColorsChange(
  club: ClubId,
  colors: ClubColors
): SelectionChange {
  let updated: ClubColorsChoice | undefined;
  return (content) => {
    // checked as it first applies, so an adapter rejects a colour as any
    // failure; applied again (a change still to be stored), it is not
    updated ??= {
      clubId: club,
      ...clubColorsOf(colors.primary, colors.secondary),
    };
    const others = content.clubColors.filter(({ clubId }) => clubId !== club);
    const previous = content.clubColors.find(({ clubId }) => clubId === club);
    return previous !== undefined && sameColors(previous, updated)
      ? content
      : { ...content, clubColors: byClub([...others, updated]) };
  };
}

/** Takes the colours of `club` away, so the app's own apply again. */
export function resetClubColorsChange(club: ClubId): SelectionChange {
  return (content) => {
    const others = content.clubColors.filter(({ clubId }) => clubId !== club);
    return others.length === content.clubColors.length
      ? content
      : { ...content, clubColors: others };
  };
}

/**
 * Takes what `handedOver` holds out: each list's entries as they were (one
 * changed since, a Kind's Spitzname or a Verein's colours, stays). What
 * joined since stays too.
 */
export function handOverChange(handedOver: SelectionContent): SelectionChange {
  return (selection) => {
    const left = everyList<SelectionLists>((list) =>
      listWithout(list, selection, handedOver, true)
    );
    return SELECTION_LISTS.every(
      (list) => left[list].length === selection[list].length
    )
      ? selection
      : // the entries that stay keep their places (`since`)
        { ...selection, ...left };
  };
}

/** Unmarks the Kind `person`, if it is marked. */
export function unmarkChange(person: PersonId): SelectionChange {
  return (content) =>
    isMarked(content, person)
      ? {
          ...content,
          children: content.children.filter(
            (child) => child.personId !== person
          ),
        }
      : content;
}

/**
 * Refuses `after` where a change made a list longer than its cap
 * (`SELECTION_LIMITS`), with `SelectionFullError`. A list already over it (as
 * read) may still shrink.
 */
export function checkLimits(
  before: SelectionContent,
  after: SelectionContent
): void {
  for (const list of SELECTION_LISTS) {
    if (
      after[list].length > before[list].length &&
      after[list].length > SELECTION_LIMITS[list]
    ) {
      throw new SelectionFullError(list);
    }
  }
}

/** What `read` holds; nothing for no document or a newer version's. */
export function contentOf(read: ReadDocument): SelectionContent {
  return read.kind === 'current' ? read : EMPTY_SELECTION;
}

function isMarked(content: SelectionContent, person: PersonId): boolean {
  return content.children.some((child) => child.personId === person);
}
