import { emulatorEnv } from '@wolsok/shared-firebase-emulator';
import { getApps, initializeApp } from 'firebase-admin/app';
import { type Firestore, getFirestore } from 'firebase-admin/firestore';
import { clearBanCache } from '../limits';

/**
 * The Firestore emulator for an emulator spec (`*.emulator.ts`): starts the
 * admin app on the project `test-emulator` runs (`--project`) once and, before each test, clears
 * the ban cache and every document. Call it once at the spec file's top
 * level, before its own hooks, so they run on the cleared database.
 */
export function useEmulatorDb(): Firestore {
  const project = emulatorEnv('GCLOUD_PROJECT');
  if (getApps().length === 0) {
    initializeApp({ projectId: project });
  }
  beforeEach(async () => {
    clearBanCache();
    await clearFirestore(project);
  });
  return getFirestore();
}

async function clearFirestore(project: string): Promise<void> {
  const response = await fetch(
    `http://${emulatorEnv('FIRESTORE_EMULATOR_HOST')}/emulator/v1/projects/${project}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
  if (!response.ok) {
    throw new Error(`Clearing the emulator failed: ${response.status}`);
  }
}
