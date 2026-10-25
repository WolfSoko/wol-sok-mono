import {
  BALANCE_VERSION,
  BOARD_CUT,
  type BoardRow,
  competitionRanks,
  parseBoardId,
  TOP_ROWS,
  VISIBLE_STATUSES,
} from '@wolsok/feat-lazy-bac-game/engine';
import {
  FieldValue,
  type Firestore,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

/** An entry as the top document needs it. */
type EntryRow = Omit<BoardRow, 'pos' | 'rank'>;

/**
 * The rows of a top document (ADR 0012), from the visible entries in board
 * order and the board's best verified ones: `pos` is 1 + the visible
 * entries above (ties share it), `rank` the verified rank inside the cut.
 */
export function topRows(
  visible: readonly EntryRow[],
  verified: readonly EntryRow[]
): BoardRow[] {
  const positions = competitionRanks(visible.map((row) => row.sort));
  const ranks = new Map(
    competitionRanks(verified.map((row) => row.sort)).map((rank, i) => [
      verified[i].entryId,
      rank,
    ])
  );
  return visible.map((row, i) => {
    const rank = ranks.get(row.entryId);
    return {
      ...row,
      pos: positions[i],
      ...(rank === undefined ? {} : { rank }),
    };
  });
}

/**
 * Rebuilds `boards/{boardId}` after a write to one of its entries - only
 * when the entry was in the top document or now beats its last row, so most
 * writes cost one read. The trigger runs one at a time (`maxInstances: 1`,
 * `concurrency: 1`): writers change entries only, and nothing contends for
 * the top document.
 */
export async function rebuildTop(
  db: Firestore,
  boardId: string,
  entryId: string,
  after: Record<string, unknown> | undefined
): Promise<'rebuilt' | 'skipped'> {
  const board = parseBoardId(boardId);
  if (board === null) {
    return 'skipped';
  }
  const topRef = db.doc(`boards/${boardId}`);
  const top = await topRef.get();
  const rows = (top.get('rows') as BoardRow[] | undefined) ?? [];
  const last = rows.at(-1);
  const visible =
    after !== undefined &&
    VISIBLE_STATUSES.includes(after['status'] as BoardRow['status']);
  const relevant =
    rows.some((row) => row.entryId === entryId) ||
    (visible &&
      (rows.length < TOP_ROWS ||
        last === undefined ||
        Number(after?.['sort']) >= last.sort));
  if (!relevant) {
    return 'skipped';
  }
  const entries = db.collection(`boards/${boardId}/entries`);
  const ordered = (query: Query) =>
    query.orderBy('sort', 'desc').orderBy('atHour', 'asc');
  const cut = BOARD_CUT[board.kind];
  const [visibleRows, verifiedRows] = await Promise.all([
    ordered(entries.where('status', 'in', [...VISIBLE_STATUSES]))
      .limit(TOP_ROWS)
      .get(),
    cut > 0
      ? ordered(entries.where('status', '==', 'verified'))
          .limit(cut)
          .get()
      : null,
  ]);
  const asRow = (doc: QueryDocumentSnapshot): EntryRow => ({
    entryId: doc.id,
    sort: doc.get('sort'),
    atHour: doc.get('atHour'),
    status: doc.get('status'),
    name: doc.get('name') ?? null,
    tag: doc.get('tag'),
    avatar: doc.get('avatar'),
    show: doc.get('show'),
  });
  await topRef.set({
    board: boardId,
    ...(board.kind === 'daily' ? { day: board.day } : {}),
    cut,
    rows: topRows(
      visibleRows.docs.map(asRow),
      verifiedRows?.docs.map(asRow) ?? []
    ),
    balanceVersion: BALANCE_VERSION,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return 'rebuilt';
}
