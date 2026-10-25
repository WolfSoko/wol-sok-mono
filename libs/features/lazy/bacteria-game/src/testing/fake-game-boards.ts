import { BehaviorSubject, map, Observable } from 'rxjs';
import {
  type BoardRow,
  compareRows,
  isVisible,
  TOP_ROWS,
  topRows,
} from '../lib/state/boards';
import type {
  BoardCursor,
  BoardMember,
  BoardTop,
  GameBoards,
  OwnEntry,
  PagedEntry,
} from '../lib/storage/game-boards';

/**
 * The boards in memory, for specs: a spec sets the top documents, the
 * entries and the players' memberships as the functions would. Like the
 * rules, it hands a player no hidden entry, and a missing one reads as
 * missing.
 */
export class FakeGameBoards implements GameBoards {
  private readonly tops = new BehaviorSubject<ReadonlyMap<string, BoardTop>>(
    new Map()
  );
  private readonly entries = new Map<string, PagedEntry[]>();
  private readonly members = new Map<string, BoardMember>();
  /** Every `countAbove` asked, as `[boardId, sort]`. */
  public readonly counts: [string, number][] = [];

  public watchTop(boardId: string): Observable<BoardTop | null> {
    return this.tops.pipe(map((tops) => tops.get(boardId) ?? null));
  }

  public async page(
    boardId: string,
    after: BoardCursor,
    limit: number
  ): Promise<PagedEntry[]> {
    return this.visible(boardId)
      .filter((entry) => compareRows(entry, after) > 0)
      .slice(0, limit);
  }

  public async member(uid: string): Promise<BoardMember | null> {
    return this.members.get(uid) ?? null;
  }

  public async entry(boardId: string, entryId: string): Promise<OwnEntry> {
    const found = (this.entries.get(boardId) ?? []).find(
      (each) => each.entryId === entryId
    );
    if (found === undefined) {
      return { state: 'missing' };
    }
    if (!isVisible(found.status)) {
      return { state: 'hidden' };
    }
    const { entryId: _id, ...entry } = found;
    return { state: 'shown', entry };
  }

  public async countAbove(boardId: string, sort: number): Promise<number> {
    this.counts.push([boardId, sort]);
    return this.visible(boardId).filter((entry) => entry.sort > sort).length;
  }

  /** Sets a board's top document. */
  public setTop(
    boardId: string,
    top: Omit<BoardTop, 'final'> & { final?: boolean }
  ): void {
    this.tops.next(
      new Map(this.tops.value).set(boardId, { final: false, ...top })
    );
  }

  /** Sets a board's entries, past the top document as well. */
  public setEntries(boardId: string, entries: PagedEntry[]): void {
    this.entries.set(boardId, entries);
  }

  /**
   * Sets a player's membership: their entry ids, and the boards they are
   * on - by default each kind's all-time board they have an id for.
   */
  public setMember(uid: string, member: Partial<BoardMember>): void {
    const entryIds = member.entryIds ?? {};
    this.members.set(uid, {
      entryIds,
      boards:
        member.boards ??
        (['xp', 'online', 'endless'] as const).filter(
          (kind) => entryIds[kind] !== undefined
        ),
      barred: member.barred ?? [],
    });
  }

  private visible(boardId: string): PagedEntry[] {
    return (this.entries.get(boardId) ?? [])
      .filter((entry) => isVisible(entry.status))
      .sort(compareRows);
  }
}

/**
 * A top document's rows from a board's entries, as `rebuildTop` makes them:
 * the visible ones in board order, at most 50, through `topRows`, with the
 * best `cut` verified ones ranked.
 */
export function topRowsOf(
  entries: readonly PagedEntry[],
  cut: number
): BoardRow[] {
  const visible = entries
    .filter((entry) => isVisible(entry.status))
    .sort(compareRows);
  return topRows(
    visible.slice(0, TOP_ROWS),
    visible.filter((entry) => entry.status === 'verified').slice(0, cut)
  );
}
