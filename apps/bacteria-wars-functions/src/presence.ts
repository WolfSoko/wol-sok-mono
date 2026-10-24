import type { Database } from 'firebase-admin/database';

/**
 * What the functions do in the Realtime Database (ADR 0012): mirror a ban,
 * drop a banned player's status and connection, and count the connections
 * for the statistics. A port, so the specs need no database emulator.
 */
export interface Presence {
  set(path: string, value: unknown): Promise<void>;
  remove(path: string): Promise<void>;
  /** The value at a path, null when there is none. */
  read(path: string): Promise<unknown>;
}

/** The port on the project's Realtime Database, opened on first use. */
export function rtdbPresence(database: () => Database): Presence {
  return {
    set: async (path, value) => {
      await database().ref(path).set(value);
    },
    remove: async (path) => {
      await database().ref(path).remove();
    },
    read: async (path) => (await database().ref(path).get()).val() as unknown,
  };
}
