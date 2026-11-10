import { type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { emulatorEnv } from '@wolsok/shared-firebase-emulator';
import { rulesTestEnvironment } from '@wolsok/shared-firebase-emulator/rules';
import { getApps, initializeApp } from 'firebase-admin/app';
import { type Firestore, getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The app's Firestore rules, as `korbjaeger:deploy` takes them. */
const APP_RULES = readFileSync(
  join(__dirname, '../../../korbjaeger/firestore.rules'),
  'utf8'
);

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
  const projectId = useEmulatorAdmin();
  let project: EmulatorProject | undefined;

  beforeAll(async () => {
    project = {
      admin: getFirestore(),
      devices: await rulesTestEnvironment(projectId, APP_RULES),
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

/**
 * Starts the admin app on the emulator project of `test-emulator`, once per
 * spec file, for specs that need no devices (Auth only); returns its id.
 */
export function useEmulatorAdmin(): string {
  const projectId = emulatorEnv('GCLOUD_PROJECT');
  if (getApps().length === 0) {
    initializeApp({ projectId });
  }
  return projectId;
}
