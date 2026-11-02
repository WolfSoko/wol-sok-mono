import { computed, inject, Injectable } from '@angular/core';
import {
  distinctUntilChanged,
  EMPTY,
  filter,
  firstValueFrom,
  map,
  Observable,
  of,
  switchMap,
} from 'rxjs';
import { SocialService } from '../social/social.service';
import {
  type BoardEntry,
  type BoardRef,
  type BoardRow,
  dailyBoardId,
  PAGE_ROWS,
} from '../state/boards';
import { GameAccount } from '../storage/game-account';
import type { BoardTop } from '../storage/game-boards';
import { GameCloud } from '../storage/game-cloud';

/** The player's own row on a board, as the screen pins it at the bottom. */
export type OwnStanding =
  /**
   * Not on this board: no counted result there yet, kept off the boards by
   * the player's profile, or hidden - by the owner, which only hides it.
   */
  | { on: false; reason: 'none' | 'optedOut' | 'hidden' }
  /**
   * On it: the entry as read and, when it was below the top document, the
   * visible entries above it, counted - else null.
   */
  | { on: true; entryId: string; entry: BoardEntry; above: number | null };

/** The own row's place: its entry, its position - ties share it - and rank. */
export interface OwnPlace {
  entry: BoardEntry;
  pos: number;
  /** The verified rank, inside the cut only. */
  rank: number | null;
}

/**
 * Where the own entry stands on the board's live top rows: as its row
 * there says, else by the count taken when it was read, else among the
 * rows it ties with or beats.
 */
export function ownPlace(
  own: Extract<OwnStanding, { on: true }>,
  rows: readonly BoardRow[]
): OwnPlace {
  const row = rows.find((each) => each.entryId === own.entryId);
  if (row !== undefined) {
    return { entry: row, pos: row.pos, rank: row.rank ?? null };
  }
  const above =
    own.above ?? rows.filter((each) => each.sort > own.entry.sort).length;
  return { entry: own.entry, pos: 1 + above, rank: null };
}

/** The id of a board by its reference. */
export function idOfBoard(ref: BoardRef): string {
  return ref.kind === 'daily' ? dailyBoardId(ref.day) : ref.kind;
}

/**
 * Reads the leaderboards for the screen (ADR 0012, "Reading a board"): the
 * top 50 live from the board's top document, further pages 25 at a time,
 * and the player's own row from their membership - its place from the top
 * document, else one `count()`, never a scan. Everything waits for a
 * signed-in player (the guest signs in on the visit), as the rules want.
 * Without the game's cloud there are none.
 */
@Injectable({ providedIn: 'root' })
export class BoardsService {
  private readonly boards = inject(GameCloud).boards();
  private readonly account = inject(GameAccount);
  private readonly social = inject(SocialService);
  private readonly playerId$ = this.account.players.pipe(
    map(({ playerId }) => playerId),
    distinctUntilChanged()
  );

  /** False without the game's cloud: boards need the online game. */
  public readonly available = this.boards !== null;

  /** True while the player's saved profile keeps them off the boards. */
  public readonly optedOut = computed(
    () => this.social.profile()?.boardOptOut === true
  );

  /**
   * A board's top 50, live - null while it has none. Listens only while a
   * player is signed in, as the rules want, and again for the next one.
   */
  public watchTop(ref: BoardRef): Observable<BoardTop | null> {
    const boards = this.boards;
    return boards === null
      ? of(null)
      : this.playerId$.pipe(
          switchMap((playerId) =>
            playerId === null ? EMPTY : boards.watchTop(idOfBoard(ref))
          )
        );
  }

  /**
   * The rows after `last`, the `shown`th row, in display order - with
   * their positions counted on by order, ties sharing one.
   */
  public async page(
    ref: BoardRef,
    last: BoardRow,
    shown: number
  ): Promise<BoardRow[]> {
    const boards = this.boards;
    if (boards === null) {
      return [];
    }
    await this.signedIn();
    const entries = await boards.page(
      idOfBoard(ref),
      { sort: last.sort, atHour: last.atHour, entryId: last.entryId },
      PAGE_ROWS
    );
    const rows: BoardRow[] = [];
    let before = last;
    entries.forEach((entry, index) => {
      const pos = entry.sort === before.sort ? before.pos : shown + index + 1;
      const row = { ...entry, pos };
      rows.push(row);
      before = row;
    });
    return rows;
  }

  /**
   * The player's own entry on a board, given its top 50: counts the
   * entries above it only when it is below them.
   */
  public async ownStanding(
    ref: BoardRef,
    top: BoardTop | null
  ): Promise<OwnStanding> {
    const boards = this.boards;
    if (boards === null) {
      return { on: false, reason: 'none' };
    }
    if (this.optedOut()) {
      return { on: false, reason: 'optedOut' };
    }
    const uid = await this.signedIn();
    const board = idOfBoard(ref);
    const member = await boards.member(uid);
    const entryId = member?.entryIds[ref.kind];
    // The entry ids come all at once; `boards` lists where the player is.
    if (
      member === null ||
      entryId === undefined ||
      !member.boards.includes(board)
    ) {
      return { on: false, reason: 'none' };
    }
    if (member.barred.includes(ref.kind)) {
      return { on: false, reason: 'hidden' };
    }
    const own = await boards.entry(board, entryId);
    // A missing entry: the functions deleted it, or never wrote it.
    if (own.state !== 'shown') {
      return { on: false, reason: own.state === 'hidden' ? 'hidden' : 'none' };
    }
    const { entry } = own;
    const rows = top?.rows ?? [];
    const last = rows.at(-1);
    const below =
      !rows.some((each) => each.entryId === entryId) &&
      (last === undefined || entry.sort < last.sort);
    return {
      on: true,
      entryId,
      entry,
      above: below ? await boards.countAbove(board, entry.sort) : null,
    };
  }

  /** The player's uid, once there is one: a guest signs in on the visit. */
  private signedIn(): Promise<string> {
    return firstValueFrom(
      this.playerId$.pipe(
        filter((playerId): playerId is string => playerId !== null)
      )
    );
  }
}
