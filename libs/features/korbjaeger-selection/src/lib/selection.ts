import type { Signal } from '@angular/core';
import type {
  PersonId,
  TeamId,
  ClubId,
} from '@wolsok/feat-shared-basketball-data';
import type { ClubColors } from './club-colors';
import type { ClubColorsChoice } from './club-colors-choice';
import type { Child, MarkablePlayer } from './child';
import type { TeamPlace } from './selection-document';

/**
 * What an Elternteil follows: Meine Teams and the Kinder they marked, and
 * the colours they gave Vereine (#2918). Kept
 * on the device by `LocalSelection`, in the account of a signed-in
 * Elternteil by `FirestoreSelection`. Every adapter passes the shared
 * contract, `selectionContract` (`testing/auswahl-vertrag.ts`).
 *
 * Errors: a change shows in `teams` or `children` once its promise resolves. Where an
 * adapter cannot store it lastingly (the device's storage full or
 * blocked), the change still holds for this visit and the promise
 * resolves. Where a newer version of the app stored the selection, the
 * adapter leaves it untouched: `teams` and `children` are empty and every
 * change rejects
 * with `SelectionTooNewError` (`selection-errors.ts`).
 */
export interface Selection {
  /**
   * Meine Teams, in the order they were followed, each once; `undefined`
   * until the adapter has read them, so no screen takes "not read yet"
   * for "none".
   */
  readonly teams: Signal<readonly TeamId[] | undefined>;
  /**
   * Whether the selection cannot be read (the account's, its listener
   * failed): `teams` and `children` then stay `undefined`, and screens say so
   * rather than wait.
   */
  readonly unreadable: Signal<boolean>;
  /**
   * Which store holds the choices now: the same value while one does, a
   * new one once the device's and an account's take turns (a sign-in or
   * sign-out, here or in another tab). An undo offered for a change keeps
   * to the store it was made in.
   */
  readonly source: Signal<unknown>;
  /**
   * Adds `team` to Meine Teams, unless it is in them already: at `place`,
   * the place `unfollow` gave for it (an undo), else at the end. Only once
   * `teams` is read.
   */
  follow(team: TeamId, place?: TeamPlace): Promise<void>;
  /**
   * Takes `team` out of Meine Teams, if it is in them; resolves with the
   * place it had, for `follow` to put it back there, or `undefined` where
   * it was not followed.
   */
  unfollow(team: TeamId): Promise<TeamPlace | undefined>;
  /**
   * The marked Kinder, in the order they were marked, each person once;
   * `undefined` until the adapter has read them. A Spitzname is trimmed
   * and at most `NICKNAME_LENGTH` characters (`nicknameOf`).
   */
  readonly children: Signal<readonly Child[] | undefined>;
  /**
   * Marks `player`, a named player, as a Kind with `nickname`, at the end
   * of the Kinder; a Kind marked already stays as it is. Only once
   * `children` is read.
   */
  mark(player: MarkablePlayer, nickname?: string): Promise<void>;
  /**
   * Gives the Kind `person` the Spitzname `nickname`, or none; ignored for
   * a person not marked.
   */
  setNickname(person: PersonId, nickname: string | undefined): Promise<void>;
  /** Unmarks the Kind `person`, if it is marked. */
  unmark(person: PersonId): Promise<void>;
  /**
   * The colours given to Vereine, one entry a Verein, by its id;
   * `undefined` until the adapter has read them. A Verein without an entry
   * shows the app's own colours.
   */
  readonly clubColors: Signal<readonly ClubColorsChoice[] | undefined>;
  /**
   * Gives `club` the colours `colors`, in place of any it has; each is
   * stored in lower case, and what is no `#rrggbb` rejects with
   * `NotAColorError`. Only once `clubColors` is read.
   */
  setClubColors(club: ClubId, colors: ClubColors): Promise<void>;
  /** Takes the colours of `club` away, if it has any. */
  resetClubColors(club: ClubId): Promise<void>;
}
