import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { getApps, initializeApp } from 'firebase-admin/app';
import { type Firestore, getFirestore } from 'firebase-admin/firestore';
import { setLogLevel } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The app's Firestore rules, as `korbjaeger:deploy` takes them. */
const APP_RULES = readFileSync(
  join(__dirname, '../../../korbjaeger/firestore.rules'),
  'utf8'
);

/** A variable `firebase emulators:exec` sets: missing outside test-emulator. */
function emulatorEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`${name} is not set: run test-emulator`);
  }
  return value;
}

export interface EmulatorProject {
  /** Firestore as the functions see it: admin, past the rules. */
  readonly admin: Firestore;
  /** The devices' side: clients under the app's real rules. */
  readonly devices: RulesTestEnvironment;
}

/**
 * The Firestore emulator of `test-emulator` for a spec file: the admin app
 * and the devices on one project (the one `--project` names), so the
 * functions' writes and the devices' requests meet as in production. Clears
 * every document before each test; call it once at the file's top level.
 */
export function useEmulatorProject(): () => EmulatorProject {
  const projectId = emulatorEnv('GCLOUD_PROJECT');
  const [host, port] = emulatorEnv('FIRESTORE_EMULATOR_HOST').split(':');
  if (getApps().length === 0) {
    initializeApp({ projectId });
  }
  let project: EmulatorProject | undefined;

  beforeAll(async () => {
    // the denials the specs expect are not logged
    setLogLevel('silent');
    project = {
      admin: getFirestore(),
      devices: await initializeTestEnvironment({
        projectId,
        firestore: { host, port: Number(port), rules: APP_RULES },
      }),
    };
  });

  beforeEach(() => project?.devices.clearFirestore());

  afterAll(() => project?.devices.cleanup());

  return () => {
    if (project === undefined) {
      throw new Error('The emulator project is used before beforeAll');
    }
    return project;
  };
}
