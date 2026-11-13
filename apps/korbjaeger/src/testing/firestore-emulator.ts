import {
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { type Firestore, getDoc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import {
  type FirestoreEmulator,
  rulesTestEnvironment,
} from '@wolsok/shared-firebase-emulator/rules';
import { selectionDocumentOf } from '@wolsok/feat-korbjaeger-selection';

/**
 * Where the specs' Firestore emulator runs (`test-emulator`): as
 * `emulator/firebase.test.json` sets it, on ports of their own, apart from
 * the e2e's emulators and the other apps'.
 */
export const FIRESTORE_EMULATOR: FirestoreEmulator = (
  JSON.parse(
    readFileSync(
      new URL('../../emulator/firebase.test.json', import.meta.url),
      'utf8'
    )
  ) as { emulators: { firestore: { host: string; port: number } } }
).emulators.firestore;

/** The app's Firestore rules (`firestore.rules`), as the deploy takes them. */
export const APP_RULES = readFileSync(
  new URL('../../firestore.rules', import.meta.url),
  'utf8'
);

/** Rules that let everything through, for documents the app's would refuse. */
export const OPEN_RULES = `rules_version = '2';
  service cloud.firestore {
    match /{document=**} { allow read, write: if true; }
  }`;

/**
 * A project of its own on the specs' emulator, under `rules`; the denials
 * the specs expect are not logged.
 */
export function emulatorProject(
  projectId: string,
  rules: string
): Promise<RulesTestEnvironment> {
  return rulesTestEnvironment(projectId, rules, FIRESTORE_EMULATOR);
}

/** A device signed in as `uid`: a Firestore instance of its own. */
export function asDevice(env: RulesTestEnvironment, uid: string): Firestore {
  return env.authenticatedContext(uid).firestore() as unknown as Firestore;
}

/** Does `act` past the rules, as an earlier write or another version did. */
export async function withoutRules<T>(
  env: RulesTestEnvironment,
  act: (firestore: Firestore) => Promise<T>
): Promise<T> {
  let result!: T;
  await env.withSecurityRulesDisabled(async (context: RulesTestContext) => {
    result = await act(context.firestore() as unknown as Firestore);
  });
  return result;
}

/** Stores `data` as the `SelectionDocument` of `uid`, past the rules. */
export function seed(
  env: RulesTestEnvironment,
  uid: string,
  data: unknown
): Promise<void> {
  return withoutRules(env, (firestore) =>
    setDoc(selectionDocumentOf(firestore, uid), data as object)
  );
}

/** What the `SelectionDocument` of `uid` holds, read past the rules; `null` for none. */
export function stored(
  env: RulesTestEnvironment,
  uid: string
): Promise<unknown> {
  return withoutRules(env, async (firestore) => {
    const snapshot = await getDoc(selectionDocumentOf(firestore, uid));
    return snapshot.exists() ? snapshot.data() : null;
  });
}
