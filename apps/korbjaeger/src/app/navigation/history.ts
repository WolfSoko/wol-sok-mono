/**
 * The entries of the browser's history this start of the app created, each
 * known by the router's `navigationId` that Angular keeps in its state,
 * and the one shown now. Entries of other sites, or of an earlier start,
 * are not in it, so back and forward never leave the app.
 */
export interface NavigationHistory {
  readonly entries: readonly number[];
  /** Index of the entry shown now in `entries`, -1 while there is none. */
  readonly position: number;
}

/** What a navigation did to the history. */
export type HistoryStep =
  /** A new entry, dropping every entry ahead of the current one. */
  | { readonly kind: 'push'; readonly id: number }
  /** The current entry gets a new id (`replaceUrl`, the first navigation). */
  | { readonly kind: 'replace'; readonly id: number }
  /**
   * Back or forward (`popstate`) to the entry that held `restoredId`; it
   * holds `id` from then on (Angular writes the restoring navigation's).
   */
  | {
      readonly kind: 'restore';
      readonly restoredId: number;
      readonly id: number;
    };

export const EMPTY_HISTORY: NavigationHistory = { entries: [], position: -1 };

/** The history once `step` happened. */
export function historyAfter(
  history: NavigationHistory,
  step: HistoryStep
): NavigationHistory {
  switch (step.kind) {
    case 'push':
      return pushed(history, step.id);
    case 'replace':
      return history.position < 0
        ? pushed(history, step.id)
        : {
            entries: history.entries.with(history.position, step.id),
            position: history.position,
          };
    case 'restore':
      return restored(history, step.restoredId, step.id);
  }
}

/** Whether an entry of this start lies behind the current one. */
export function canGoBack(history: NavigationHistory): boolean {
  return history.position > 0;
}

/** Whether an entry of this start lies ahead of the current one. */
export function canGoForward(history: NavigationHistory): boolean {
  return history.position < history.entries.length - 1;
}

function pushed(history: NavigationHistory, id: number): NavigationHistory {
  const entries = [...history.entries.slice(0, history.position + 1), id];
  return { entries, position: entries.length - 1 };
}

/**
 * An entry this start does not know (one from before a reload) starts the
 * history anew, as what lies around it is unknown.
 */
function restored(
  history: NavigationHistory,
  restoredId: number,
  id: number
): NavigationHistory {
  const position = history.entries.indexOf(restoredId);
  return position < 0
    ? { entries: [id], position: 0 }
    : { entries: history.entries.with(position, id), position };
}
