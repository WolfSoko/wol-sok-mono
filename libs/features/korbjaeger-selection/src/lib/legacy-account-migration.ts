import { LEGACY_CHOICES_COLLECTION } from '@wolsok/feat-shared-korbjaeger-account';
import {
  deleteDoc,
  doc,
  type DocumentReference,
  type Firestore,
  getDocFromServer,
} from 'firebase/firestore';
import { contentOf } from './selection-changes';
import { readSelectionDocument } from './selection-document';
import { takeOverDevice } from './take-over-device';
import { legacySelection } from './legacy-selection';

/** The account's selection as versions 1 and 2 stored it, `auswahl/{uid}`. */
export function legacySelectionDocument(
  firestore: Firestore,
  uid: string
): DocumentReference {
  return doc(firestore, LEGACY_CHOICES_COLLECTION, uid);
}

/**
 * Moves the account's legacy selection (`legacySelectionDocument`, German
 * fields) into its document of this version (#2966): joins what it holds
 * into the account as a sign-in joins the device's choices
 * (`takeOverDevice`: the account's first, one transaction a map, only
 * what fits under the caps), then deletes it. Read from the server, as the
 * cache may hold it after another device moved it. The deletion comes last,
 * so a run cut short repeats on the next call and joins the same entries
 * again, which changes nothing. Rejects where the server cannot be reached
 * or a newer version stored the account's selection (`SelectionTooNewError`),
 * leaving the legacy document for the next call.
 */
export async function legacyAccountMigration(
  firestore: Firestore,
  uid: string
): Promise<void> {
  const legacy = legacySelectionDocument(firestore, uid);
  const stored = await getDocFromServer(legacy);
  if (!stored.exists()) {
    return;
  }
  const read = readSelectionDocument(legacySelection(stored.data()));
  if (read.kind === 'current') {
    await takeOverDevice(firestore, uid, contentOf(read));
  }
  await deleteDoc(legacy);
}
