import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { setLogLevel } from 'firebase/firestore';

/** Where a spec's Firestore emulator listens. */
export interface FirestoreEmulator {
  readonly host: string;
  readonly port: number;
}

/**
 * A project on the Firestore emulator under `rules`, for devices' requests
 * as the rules judge them; the denials the specs expect are not logged.
 * Without `firestore`, the emulator is the one `FIRESTORE_EMULATOR_HOST`
 * names (`firebase emulators:exec` sets it).
 */
export function rulesTestEnvironment(
  projectId: string,
  rules: string,
  firestore?: FirestoreEmulator
): Promise<RulesTestEnvironment> {
  setLogLevel('silent');
  return initializeTestEnvironment({
    projectId,
    firestore: { ...firestore, rules },
  });
}
