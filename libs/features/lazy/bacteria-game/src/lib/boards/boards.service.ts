import { computed, inject, Injectable } from '@angular/core';
import { filter, firstValueFrom, map, Observable, of } from 'rxjs';
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
   * On it: the entry, its visible position - ties share it - and, inside
   * the verified places, its verified rank.
   */
  | { on: true; entry: BoardEntry; pos: number; rank: number | null };

/** The id of a board by its reference. */
export function idOfBoard(ref: BoardRef): string {
  return ref.kind === 'daily' ? dailyBoardId(ref.day) : ref.kind;
}

/**
 * Reads the leaderboards for the screen (ADR 0012, "Reading a board"): the
 * top 50 live from the board's top document, further pages 25 at a time,
 * and the player's own row from their membership - its rank from the top
 * document, else one `count()`, never a scan. Without the game's cloud
 * there are none.
 */
@Injectable({ providedIn: 'root' })
export class BoardsService {
  private readonly boards = inject(GameCloud).boards();
  private readonly account = inject(GameAccount);
  private readonly social = inject(SocialService);

  /** False without the game's cloud: boards need the online game. */
  public readonly available = this.boards !== null;

  /** True while the player's saved profile keeps them off the boards. */
  public readonly optedOut = computed(
    () => this.social.profile()?.boardOptOut === true
  );

  /** A board's top 50, live - null while it has none. */
  public watchTop(ref: BoardRef): Observable<BoardTop | null> {
    return this.boards === null
      ? of(null)
      : this.boards.watchTop(idOfBoard(ref));
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
    if (this.boards === null) {
      return [];
    }
    const entries = await this.boards.page(
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

  /** The player's own row on a board, with its rank, given its top 50. */
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
    const uid = await firstValueFrom(
      this.account.players.pipe(
        map(({ playerId }) => playerId),
        filter((playerId): playerId is string => playerId !== null)
      )
    );
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
    if (own.state !== 'shown') {
      return { on: false, reason: own.state === 'hidden' ? 'hidden' : 'none' };
    }
    const { entry } = own;
    const row = top?.rows.find((each) => each.entryId === entryId);
    if (row !== undefined) {
      return { on: true, entry, pos: row.pos, rank: row.rank ?? null };
    }
    const rows = top?.rows ?? [];
    const lastRow = rows.at(-1);
    const pos =
      lastRow !== undefined && entry.sort >= lastRow.sort
        ? 1 + rows.filter((each) => each.sort > entry.sort).length
        : 1 + (await boards.countAbove(board, entry.sort));
    return { on: true, entry, pos, rank: null };
  }
}
