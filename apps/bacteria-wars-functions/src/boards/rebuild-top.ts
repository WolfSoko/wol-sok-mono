import { Firestore, Timestamp } from 'firebase-admin/firestore';
import type { BoardEntry, BoardRow } from '@wolsok/feat-lazy-bac-game/engine';
import type { Engine } from '../engine';
import { dailyExpireAt } from './entries';
import type { EntryDoc } from './model';

/** The part of a top document the relevance check reads. */
interface TopRows {
  cut: number;
  rows: Pick<BoardRow, 'entryId' | 'sort' | 'status'>[];
}

/**
 * True when an entry's change can change the board's top document: it was
 * in it, or it now beats its last row, or the top has room - or it is a
 * verified entry that would enter the verified cut.
 */
export function isRelevant(
  engine: Engine,
  top: TopRows | undefined,
  entryId: string,
  after: Pick<EntryDoc, 'sort' | 'status'> | undefined
): boolean {
  if (top === undefined || !Array.isArray(top.rows)) {
    return true;
  }
  if (top.rows.some((row) => row.entryId === entryId)) {
    return true;
  }
  if (after === undefined || !engine.isVisible(after.status)) {
    return false;
  }
  const visibleRows = top.rows.slice(0, engine.TOP_ROWS);
  const last = visibleRows[visibleRows.length - 1];
  if (
    visibleRows.length < engine.TOP_ROWS ||
    (last !== undefined && after.sort >= last.sort)
  ) {
    return true;
  }
  if (after.status !== 'verified' || top.cut === 0) {
    return false;
  }
  const verified = top.rows.filter((row) => row.status === 'verified');
  return (
    verified.length < top.cut ||
    after.sort >= verified[verified.length - 1].sort
  );
}

/** An entry as a row of the top document holds it. */
function asEntry(id: string, doc: EntryDoc): BoardEntry & { entryId: string } {
  return {
    entryId: id,
    sort: doc.sort,
    atHour: doc.atHour,
    status: doc.status,
    name: doc.name,
    tag: doc.tag,
    avatar: doc.avatar,
    show: doc.show,
  };
}

/**
 * `rebuildTop` (ADR 0012), on writes to a board's entries, one at a time
 * (`maxInstances: 1`, `concurrency: 1`), so the ranking functions never
 * contend for the top document: returns at once unless the entry is
 * relevant, else rebuilds `boards/{boardId}` from the top 50 visible
 * entries and the top `cut` verified ones, with positions (ties share
 * them) and, inside the cut, the verified rank. A delete on a daily board
 * past its TTL is TTL draining it, and rebuilds nothing. Returns true when
 * it wrote.
 */
export async function rebuildTop(
  db: Firestore,
  engine: Engine,
  boardId: string,
  entryId: string,
  after: EntryDoc | undefined,
  now = Date.now()
): Promise<boolean> {
  const board = engine.parseBoardId(boardId);
  if (board === null) {
    return false;
  }
  // TTL draining a past daily board: its top document expires as well.
  if (
    after === undefined &&
    board.kind === 'daily' &&
    dailyExpireAt(board.day).toMillis() <= now
  ) {
    return false;
  }
  const topRef = db.doc(`boards/${boardId}`);
  const top = await topRef.get();
  if (
    !isRelevant(
      engine,
      top.exists ? (top.data() as TopRows) : undefined,
      entryId,
      after
    )
  ) {
    return false;
  }
  const cut = engine.BOARD_CUT[board.kind];
  const entries = db.collection(`boards/${boardId}/entries`);
  const visible = (
    await entries
      .where('status', 'in', engine.VISIBLE_STATUSES)
      .orderBy('sort', 'desc')
      .orderBy('atHour', 'asc')
      .limit(engine.TOP_ROWS)
      .get()
  ).docs.map((doc) => asEntry(doc.id, doc.data() as EntryDoc));
  const verified =
    cut === 0
      ? []
      : (
          await entries
            .where('status', '==', 'verified')
            .orderBy('sort', 'desc')
            .orderBy('atHour', 'asc')
            .limit(cut)
            .get()
        ).docs.map((doc) => asEntry(doc.id, doc.data() as EntryDoc));
  const rows: BoardRow[] = engine.topRows(visible, cut);
  const shown = new Set(rows.map((row) => row.entryId));
  for (const [index, entry] of verified.entries()) {
    if (shown.has(entry.entryId)) {
      continue;
    }
    // A verified entry inside the cut but below the top 50: its position
    // is counted, its verified rank is its place among the verified.
    const higher = await entries
      .where('status', 'in', engine.VISIBLE_STATUSES)
      .where('sort', '>', entry.sort)
      .count()
      .get();
    const rank =
      1 + verified.slice(0, index).filter((v) => v.sort > entry.sort).length;
    rows.push({ ...entry, pos: higher.data().count + 1, rank });
  }
  await topRef.set(
    {
      board: boardId,
      ...(board.kind === 'daily'
        ? { day: board.day, expireAt: dailyExpireAt(board.day) }
        : {}),
      cut,
      rows,
      balanceVersion: engine.BALANCE_VERSION,
      updatedAt: Timestamp.fromMillis(now),
    },
    { merge: true }
  );
  return true;
}
