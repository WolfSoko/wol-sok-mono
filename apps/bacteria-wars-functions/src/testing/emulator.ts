import { beforeEach } from '@jest/globals';
import { getApps, initializeApp } from 'firebase-admin/app';
import { type Firestore, getFirestore } from 'firebase-admin/firestore';
import { clearBanCache } from '../limits';

/** The project `test-emulator` starts the emulator for. */
const EMULATOR_PROJECT = 'demo-bacteria-functions';

/**
 * The Firestore emulator for an emulator spec (`*.emulator.ts`): starts the
 * admin app on the emulator's project once and, before each test, clears
 * the ban cache and every document. Call it once at the spec file's top
 * level, before its own hooks, so they run on the cleared database.
 */
export function useEmulatorDb(): Firestore {
  if (getApps().length === 0) {
    initializeApp({ projectId: EMULATOR_PROJECT });
  }
  beforeEach(async () => {
    clearBanCache();
    await clearFirestore();
  });
  return getFirestore();
}

async function clearFirestore(): Promise<void> {
  const host = process.env['FIRESTORE_EMULATOR_HOST'];
  if (host === undefined) {
    throw new Error('FIRESTORE_EMULATOR_HOST is not set: run test-emulator');
  }
  const response = await fetch(
    `http://${host}/emulator/v1/projects/${EMULATOR_PROJECT}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
  if (!response.ok) {
    throw new Error(`Clearing the emulator failed: ${response.status}`);
  }
}
