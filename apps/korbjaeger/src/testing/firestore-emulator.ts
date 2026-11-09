import { readFileSync } from 'node:fs';

/**
 * Where the specs' Firestore emulator runs (`test-emulator`): as
 * `emulator/firebase.test.json` sets it, on ports of their own, apart from
 * the e2e's emulators and the other apps'.
 */
export const FIRESTORE_EMULATOR: {
  readonly host: string;
  readonly port: number;
} = (
  JSON.parse(
    readFileSync(
      new URL('../../emulator/firebase.test.json', import.meta.url),
      'utf8'
    )
  ) as { emulators: { firestore: { host: string; port: number } } }
).emulators.firestore;
