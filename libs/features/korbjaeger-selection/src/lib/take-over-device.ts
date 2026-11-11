import {
  type DocumentReference,
  type Firestore,
  runTransaction,
} from 'firebase/firestore';
import { contentOf } from './selection-changes';
import {
  readSelectionDocument,
  selectionFields,
  listFields,
  nextSince,
} from './selection-document';
import {
  SELECTION_LISTS,
  everyList,
  type SelectionContent,
  type SelectionList,
  type SelectionLists,
} from './selection-lists';
import { SelectionTooNewError } from './selection-errors';
import { selectionDocumentOf, firestoreFields } from './firestore-selection';
import { type NotTakenOver, mergeSelections } from './merge-selections';

/**
 * Takes `geraet`, the choices made on the device, into the account `uid`
 * at sign-in, as `zusammenfuehren` joins them: on every sign-in, since a
 * second one with the same choices changes nothing. Written as every
 * change is (`auswahlFelder`): only the entries the device adds, by id. One
 * transaction a map; a map the device adds nothing to is not written. Only what fits under the caps joins; resolves
 * with the device's Teams, Kinder and Vereinsfarben that did not; a list
 * the device holds nothing of is not read. Rejects with
 * `AuswahlZuNeuError` where a newer version of the app stored the
 * account's selection, which it leaves alone.
 */
export async function takeOverDevice(
  firestore: Firestore,
  uid: string,
  device: SelectionContent
): Promise<NotTakenOver> {
  const documentRef = selectionDocumentOf(firestore, uid);
  const left: Partial<Record<SelectionList, readonly unknown[]>> = {};
  // one map a transaction, one after the other
  for (const list of SELECTION_LISTS) {
    // a list the device holds nothing of adds nothing: no round trip
    if (device[list].length > 0) {
      const leftOver = await takeOverList(firestore, documentRef, device, list);
      left[list] = leftOver[list];
    }
  }
  return everyList<SelectionLists>((list) => left[list] ?? []);
}

/**
 * Takes the map `liste` of `geraet` into the account, in a transaction of
 * its own, as the rules check one full map a write.
 */
function takeOverList(
  firestore: Firestore,
  documentRef: DocumentReference,
  device: SelectionContent,
  list: SelectionList
): Promise<NotTakenOver> {
  return runTransaction(firestore, async (transaction) => {
    const read = readSelectionDocument(
      (await transaction.get(documentRef)).data()
    );
    if (read.kind === 'newer') {
      throw new SelectionTooNewError();
    }
    const account = contentOf(read);
    const merged = mergeSelections(account, device);
    const fields = selectionFields(
      account,
      { ...account, [list]: merged.content[list] },
      nextSince(read)
    );
    if (listFields(fields, list) !== undefined) {
      transaction.set(documentRef, firestoreFields(fields), { merge: true });
    }
    return merged.left;
  });
}
