import type { Database } from 'firebase-admin/database';

/**
 * What the admin commands do in the Realtime Database (ADR 0012): mirror a
 * ban to `bans/{uid}`, and drop a banned player's `status` and
 * `connections`. A port, so the specs run against the Firestore emulator
 * alone.
 */
export interface Realtime {
  set(path: string, value: number): Promise<void>;
  remove(path: string): Promise<void>;
  /** Removes the value at `path` only while it is still `expected`. */
  removeIf(path: string, expected: number): Promise<void>;
}

/** The port on the project's Realtime Database, opened on first use. */
export function realtimeOf(database: () => Promise<Database>): Realtime {
  return {
    set: async (path, value) => {
      await (await database()).ref(path).set(value);
    },
    remove: async (path) => {
      await (await database()).ref(path).remove();
    },
    removeIf: async (path, expected) => {
      // The first call may see null before the server's value; keeping
      // what it sees writes nothing new, and the server retries it.
      await (
        await database()
      )
        .ref(path)
        .transaction((current: unknown) =>
          current === expected ? null : current
        );
    },
  };
}
