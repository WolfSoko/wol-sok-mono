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
 * A project on the Firestore emulator under `rules`, for devices'
 * requests as the rules judge them; the denials the specs expect are not
 * logged.
 */
export function rulesTestEnvironment(
  projectId: string,
  firestore: FirestoreEmulator,
  rules: string
): Promise<RulesTestEnvironment> {
  setLogLevel('silent');
  return initializeTestEnvironment({
    projectId,
    firestore: { host: firestore.host, port: firestore.port, rules },
  });
}
