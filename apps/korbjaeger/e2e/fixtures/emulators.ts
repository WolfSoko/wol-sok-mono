import type { APIRequestContext } from '@playwright/test';
import { CHOICES_COLLECTION } from '@wolsok/feat-shared-korbjaeger-account';
import { readFileSync } from 'node:fs';

const emulatorConfig = JSON.parse(
  readFileSync(
    new URL('../../firebase.emulatoren.json', import.meta.url),
    'utf8'
  )
) as {
  emulators: Record<'auth' | 'firestore', { host: string; port: number }>;
};

/** The e2e's emulators (`korbjaeger:emulatoren`), asked past the rules as their owner. */
const PROJECT = 'demo-korbjaeger';
const AS_OWNER = { Authorization: 'Bearer owner' };
const AUTH = `http://${emulatorConfig.emulators.auth.host}:${emulatorConfig.emulators.auth.port}`;
const FIRESTORE = `http://${emulatorConfig.emulators.firestore.host}:${emulatorConfig.emulators.firestore.port}`;

/**
 * The uid of the Auth emulator's account with `email`; none where it has
 * none. Throws where the emulator does not answer as it should, so a check
 * that an account is gone never passes on a failed query.
 */
export async function uidOf(
  request: APIRequestContext,
  email: string
): Promise<string | undefined> {
  const answer = await request.post(
    `${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:query`,
    // the emulator filters no query: every account, found here by email
    { headers: AS_OWNER, data: {} }
  );
  if (!answer.ok()) {
    throw new Error(`Auth emulator: HTTP ${answer.status()}`);
  }
  const { userInfo } = (await answer.json()) as {
    userInfo?: { localId: string; email?: string }[];
  };
  return userInfo?.find((account) => account.email === email)?.localId;
}

/**
 * Whether the Firestore emulator holds the `AuswahlDokument` of `uid`:
 * false only for none (404); throws for any other failure.
 */
export async function hasSelection(
  request: APIRequestContext,
  uid: string
): Promise<boolean> {
  const answer = await request.get(
    `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/${CHOICES_COLLECTION}/${uid}`,
    { headers: AS_OWNER }
  );
  if (answer.status() === 404) {
    return false;
  }
  if (!answer.ok()) {
    throw new Error(`Firestore emulator: HTTP ${answer.status()}`);
  }
  return true;
}
