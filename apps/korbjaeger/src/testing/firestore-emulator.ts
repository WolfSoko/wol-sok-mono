import {
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { type Firestore, getDoc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import {
  type FirestoreEmulator,
  rulesTestEnvironment,
} from '@wolsok/shared-firebase-emulator';
import { auswahlDokumentVon } from '@wolsok/feat-korbjaeger-auswahl';

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
export const APP_REGELN = readFileSync(
  new URL('../../firestore.rules', import.meta.url),
  'utf8'
);

/** Rules that let everything through, for documents the app's would refuse. */
export const OFFENE_REGELN = `rules_version = '2';
  service cloud.firestore {
    match /{document=**} { allow read, write: if true; }
  }`;

/**
 * A project of its own on the specs' emulator, under `regeln`; the denials
 * the specs expect are not logged.
 */
export function emulatorProjekt(
  projectId: string,
  regeln: string
): Promise<RulesTestEnvironment> {
  return rulesTestEnvironment(projectId, FIRESTORE_EMULATOR, regeln);
}

/** A device signed in as `uid`: a Firestore instance of its own. */
export function alsGeraet(env: RulesTestEnvironment, uid: string): Firestore {
  return env.authenticatedContext(uid).firestore() as unknown as Firestore;
}

/** Does `tun` past the rules, as an earlier write or another version did. */
export async function ohneRegeln<T>(
  env: RulesTestEnvironment,
  tun: (firestore: Firestore) => Promise<T>
): Promise<T> {
  let ergebnis!: T;
  await env.withSecurityRulesDisabled(async (context: RulesTestContext) => {
    ergebnis = await tun(context.firestore() as unknown as Firestore);
  });
  return ergebnis;
}

/** Stores `daten` as the `AuswahlDokument` of `uid`, past the rules. */
export function vorhanden(
  env: RulesTestEnvironment,
  uid: string,
  daten: unknown
): Promise<void> {
  return ohneRegeln(env, (firestore) =>
    setDoc(auswahlDokumentVon(firestore, uid), daten as object)
  );
}

/** What the `AuswahlDokument` of `uid` holds, read past the rules; `null` for none. */
export function gespeichert(
  env: RulesTestEnvironment,
  uid: string
): Promise<unknown> {
  return ohneRegeln(env, async (firestore) => {
    const stand = await getDoc(auswahlDokumentVon(firestore, uid));
    return stand.exists() ? stand.data() : null;
  });
}
