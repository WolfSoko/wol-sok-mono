import { LEGACY_SELECTIONS_COLLECTION } from '@wolsok/feat-korbjaeger-collections';
import {
  deleteDoc,
  doc,
  type DocumentReference,
  type Firestore,
  getDocFromServer,
} from 'firebase/firestore';
import { inhaltAus } from './auswahl-aenderungen';
import { auswahlDokumentLesen } from './auswahl-dokument';
import { geraetUebernehmen } from './geraet-uebernehmen';
import { legacySelection } from './legacy-selection';

/** The account's selection as versions 1 and 2 stored it, `auswahl/{uid}`. */
export function legacySelectionDocument(
  firestore: Firestore,
  uid: string
): DocumentReference {
  return doc(firestore, LEGACY_SELECTIONS_COLLECTION, uid);
}

/**
 * Moves the account's legacy selection (`legacySelectionDocument`, German
 * fields) into its document of this version (#2966): joins what it holds
 * into the account as a sign-in joins the device's choices
 * (`geraetUebernehmen`: the account's first, one transaction a map, only
 * what fits under the caps), then deletes it. Read from the server, as the
 * cache may hold it after another device moved it. The deletion comes last,
 * so a run cut short repeats on the next call and joins the same entries
 * again, which changes nothing. Rejects where the server cannot be reached
 * or a newer version stored the account's selection (`AuswahlZuNeuError`),
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
  const gelesen = auswahlDokumentLesen(legacySelection(stored.data()));
  if (gelesen.art === 'aktuell') {
    await geraetUebernehmen(firestore, uid, inhaltAus(gelesen));
  }
  await deleteDoc(legacy);
}
