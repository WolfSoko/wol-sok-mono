/**
 * What a page held of a player's document after a change the game storage
 * has not stored yet - kept on the device, so a page closed before the
 * cloud had the change leaves it for the player's next visit (#2820).
 */
export interface UnsavedChange {
  /** The player the change was made for. */
  player: string;
  /** The document's value as the page held it after the change. */
  value: unknown;
}

/** The unsaved changes of a document, by entry: one per page and player. */
export type UnsavedChanges = Readonly<Record<string, UnsavedChange>>;

const NO_CHANGES: UnsavedChanges = {};

/** The device storage key the unsaved changes of a document's key go under. */
export function unsavedKey(key: string): string {
  return `${key}.unsaved`;
}

/** The entry a page keeps for a player, so two pages never share one. */
export function unsavedEntry(page: string, player: string): string {
  return `${page}:${player}`;
}

/**
 * The entry a change the storage dropped moves to: apart from the page's
 * own, which the page clears, so the player's next start takes it up.
 */
export function droppedEntry(entry: string, number: number): string {
  return `${entry}:dropped-${number}`;
}

/** The unsaved changes in a stored value, dropping what is not one. */
export function parseUnsaved(stored: unknown): UnsavedChanges {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) {
    return NO_CHANGES;
  }
  const entries = Object.entries(stored).filter(([, change]) =>
    isUnsavedChange(change)
  );
  return entries.length === 0 ? NO_CHANGES : Object.fromEntries(entries);
}

/** The changes with the entry set to `change`. */
export function withUnsaved(
  changes: UnsavedChanges,
  entry: string,
  change: UnsavedChange
): UnsavedChanges {
  return { ...changes, [entry]: change };
}

/** The changes without the entries given; the same changes without any of them. */
export function withoutUnsaved(
  changes: UnsavedChanges,
  entries: readonly string[]
): UnsavedChanges {
  if (!entries.some((entry) => entry in changes)) {
    return changes;
  }
  return Object.fromEntries(
    Object.entries(changes).filter(([entry]) => !entries.includes(entry))
  );
}

/**
 * The changes without the entries of `read` that still hold what was read:
 * an entry another page wrote again since is newer, and stays.
 */
export function withoutUnchanged(
  changes: UnsavedChanges,
  read: UnsavedChanges
): UnsavedChanges {
  const unchanged = Object.entries(read)
    .filter(
      ([entry, { value }]) =>
        entry in changes &&
        JSON.stringify(changes[entry].value) === JSON.stringify(value)
    )
    .map(([entry]) => entry);
  return withoutUnsaved(changes, unchanged);
}

/** A player's changes alone. */
export function unsavedOf(
  changes: UnsavedChanges,
  player: string
): UnsavedChanges {
  return Object.fromEntries(
    Object.entries(changes).filter(([, change]) => change.player === player)
  );
}

/** What to store for the changes: nothing once none are left. */
export function storedUnsaved(changes: UnsavedChanges): UnsavedChanges | null {
  return Object.keys(changes).length === 0 ? null : changes;
}

function isUnsavedChange(change: unknown): change is UnsavedChange {
  const { player, value } = (change ?? {}) as Partial<UnsavedChange>;
  return typeof player === 'string' && value !== undefined;
}
