import type { Firestore } from 'firebase/firestore';
import { FirestoreSelection } from './firestore-selection';

/** The listener Firestore was given, steered by each spec. */
const listener = vi.hoisted(() => ({
  weiter: undefined as ((state: unknown) => void) | undefined,
  error: undefined as ((error: unknown) => void) | undefined,
}));

vi.mock('firebase/firestore', () => ({
  deleteField: vi.fn(),
  doc: vi.fn(() => ({})),
  onSnapshot: vi.fn(
    (
      _: unknown,
      weiter: (state: unknown) => void,
      error: (f: unknown) => void
    ) => {
      listener.weiter = weiter;
      listener.error = error;
      return () => undefined;
    }
  ),
  setDoc: vi.fn(() => new Promise(() => undefined)),
}));

/** A snapshot of `data`, as the server tells it. */
const state = (data: unknown) => ({
  exists: () => data !== undefined,
  data: () => data,
  metadata: { fromCache: false },
});

describe('FirestoreSelection', () => {
  const open = () => new FirestoreSelection({} as Firestore, 'uid-1');

  it('shows nothing and takes no change once its listener failed after a read', async () => {
    const selection = open();
    listener.weiter?.(state({ version: 3, teams: { 313036: 1 } }));
    expect(selection.teams()).toEqual([313036]);

    listener.error?.({ code: 'unavailable' });

    expect(selection.unreadable()).toBe(true);
    expect(selection.teams()).toBeUndefined();
    expect(selection.children()).toBeUndefined();
    await expect(selection.follow(201500)).rejects.toThrow();
  });

  it('ends a change waiting for the first read once it is ended', async () => {
    const selection = open();
    const followed = selection.follow(201500);

    selection.stop();

    await expect(followed).rejects.toThrow();
    await expect(selection.loaded()).rejects.toThrow();
  });
});
