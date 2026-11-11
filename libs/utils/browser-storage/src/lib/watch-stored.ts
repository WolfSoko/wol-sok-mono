/** Where `storage` events arrive: the window, or a fake in specs. */
export type StorageEventTarget = Pick<
  EventTarget,
  'addEventListener' | 'removeEventListener'
>;

/**
 * Calls `onChange` whenever another tab changes `key` or clears the whole
 * storage (a `storage` event without a key), until the returned function
 * stops it. Without a target (a server) it never calls.
 */
export function watchStored(
  key: string,
  onChange: () => void,
  target: StorageEventTarget | undefined
): () => void {
  const listener = (event: Event): void => {
    if (isStorageEventFor(event, key)) {
      onChange();
    }
  };
  target?.addEventListener('storage', listener);
  return () => target?.removeEventListener('storage', listener);
}

function isStorageEventFor(event: Event, key: string): boolean {
  const changed = (event as Partial<StorageEvent>).key;
  return event.type === 'storage' && (changed === key || changed === null);
}
