import type { Database } from 'firebase-admin/database';

/**
 * What the functions do in the Realtime Database (ADR 0012): mirror a ban
 * to `bans/{uid}`, drop a banned or deleted player's `status` and
 * `connections`, and keep the friend lists' mirrors `statusReaders` and
 * `listedBy` (`social/mirror.ts`). A port, so the specs run against the
 * Firestore emulator alone.
 */
export interface Realtime {
  /** The value at `path`, null when there is none. */
  get(path: string): Promise<unknown>;
  set(path: string, value: number): Promise<void>;
  remove(path: string): Promise<void>;
  /** Removes the value at `path` only while `test` holds for it. */
  removeIf(path: string, test: (value: unknown) => boolean): Promise<void>;
  /**
   * Sets (`true`) or removes (`null`) the values at several paths at once,
   * all or none - a multi-path update from the root.
   */
  update(values: Readonly<Record<string, true | null>>): Promise<void>;
}

/** The port on the project's Realtime Database, opened on first use. */
export function realtimeOf(database: () => Promise<Database>): Realtime {
  return {
    get: async (path) => (await (await database()).ref(path).get()).val(),
    set: async (path, value) => {
      await (await database()).ref(path).set(value);
    },
    remove: async (path) => {
      await (await database()).ref(path).remove();
    },
    removeIf: async (path, test) => {
      // The first call may see null before the server's value; what it
      // writes then is checked against that value and run again.
      await (
        await database()
      )
        .ref(path)
        .transaction((current: unknown) => (test(current) ? null : current));
    },
    update: async (values) => {
      if (Object.keys(values).length > 0) {
        await (await database()).ref().update(values);
      }
    },
  };
}
