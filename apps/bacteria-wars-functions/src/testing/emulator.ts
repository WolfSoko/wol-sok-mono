import { App, deleteApp, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import type { Account, AccountLookup } from '../accounts';

/**
 * What the specs against the Firestore emulator share (`test-integration`,
 * which starts it): an app of their own, a clean emulator before each
 * test, and accounts as Auth would answer.
 */

/** The emulator's demo project - no credentials needed. */
export const PROJECT = 'demo-bacteria-wars';

/**
 * An Admin app of its own against the emulator, cleared before each test
 * and deleted after the spec - registers the hooks of the calling file.
 */
export function emulatorFirestore(name: string): Firestore {
  const app: App = initializeApp({ projectId: PROJECT }, name);
  beforeEach(clearFirestore);
  afterAll(async () => {
    await deleteApp(app);
  });
  return getFirestore(app);
}

/** Deletes every document in the emulator. */
export async function clearFirestore(): Promise<void> {
  const host = process.env['FIRESTORE_EMULATOR_HOST'];
  const response = await fetch(
    `http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
  if (!response.ok) {
    throw new Error(`Could not clear the emulator: ${response.status}`);
  }
}

/**
 * Accounts as Auth would answer: every uid is known, with the defaults for
 * it and what `extra` says of it - read at each lookup, so a test may
 * change it.
 */
export function fakeAccounts(
  defaults: (uid: string) => Omit<Account, 'uid'>,
  extra: Readonly<Record<string, Partial<Account>>> = {}
): AccountLookup {
  return async (uids) =>
    new Map(uids.map((uid) => [uid, { uid, ...defaults(uid), ...extra[uid] }]));
}
