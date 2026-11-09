import type { APIRequestContext } from '@playwright/test';
import { CHOICES_COLLECTION } from '@wolsok/feat-shared-korbjaeger-account';
import { readFileSync } from 'node:fs';

const emulatoren = JSON.parse(
  readFileSync(
    new URL('../../firebase.emulatoren.json', import.meta.url),
    'utf8'
  )
) as {
  emulators: Record<'auth' | 'firestore', { host: string; port: number }>;
};

/** The e2e's emulators (`korbjaeger:emulatoren`), asked past the rules as their owner. */
const PROJEKT = 'demo-korbjaeger';
const ALS_BESITZER = { Authorization: 'Bearer owner' };
const AUTH = `http://${emulatoren.emulators.auth.host}:${emulatoren.emulators.auth.port}`;
const FIRESTORE = `http://${emulatoren.emulators.firestore.host}:${emulatoren.emulators.firestore.port}`;

/**
 * The uid of the Auth emulator's account with `email`; none where it has
 * none. Throws where the emulator does not answer as it should, so a check
 * that an account is gone never passes on a failed query.
 */
export async function uidVon(
  request: APIRequestContext,
  email: string
): Promise<string | undefined> {
  const antwort = await request.post(
    `${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJEKT}/accounts:query`,
    // the emulator filters no query: every account, found here by email
    { headers: ALS_BESITZER, data: {} }
  );
  if (!antwort.ok()) {
    throw new Error(`Auth emulator: HTTP ${antwort.status()}`);
  }
  const { userInfo } = (await antwort.json()) as {
    userInfo?: { localId: string; email?: string }[];
  };
  return userInfo?.find((konto) => konto.email === email)?.localId;
}

/**
 * Whether the Firestore emulator holds the `AuswahlDokument` of `uid`:
 * false only for none (404); throws for any other failure.
 */
export async function hatAuswahl(
  request: APIRequestContext,
  uid: string
): Promise<boolean> {
  const antwort = await request.get(
    `${FIRESTORE}/v1/projects/${PROJEKT}/databases/(default)/documents/${CHOICES_COLLECTION}/${uid}`,
    { headers: ALS_BESITZER }
  );
  if (antwort.status() === 404) {
    return false;
  }
  if (!antwort.ok()) {
    throw new Error(`Firestore emulator: HTTP ${antwort.status()}`);
  }
  return true;
}
