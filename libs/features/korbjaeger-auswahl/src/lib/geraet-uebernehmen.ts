import {
  type DocumentReference,
  type Firestore,
  runTransaction,
} from 'firebase/firestore';
import { inhaltAus } from './auswahl-aenderungen';
import {
  auswahlDokumentLesen,
  auswahlFelder,
  listFields,
  naechsterSeit,
} from './auswahl-dokument';
import {
  AUSWAHL_LISTEN,
  everyList,
  type AuswahlInhalt,
  type AuswahlListe,
  type SelectionLists,
} from './selection-lists';
import { AuswahlZuNeuError } from './auswahl-fehler';
import { auswahlDokumentVon, firestoreFelder } from './firestore-auswahl';
import { type NichtUebernommen, zusammenfuehren } from './zusammenfuehren';

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
export async function geraetUebernehmen(
  firestore: Firestore,
  uid: string,
  geraet: AuswahlInhalt
): Promise<NichtUebernommen> {
  const dokument = auswahlDokumentVon(firestore, uid);
  const left: Partial<Record<AuswahlListe, readonly unknown[]>> = {};
  // one map a transaction, one after the other
  for (const list of AUSWAHL_LISTEN) {
    // a list the device holds nothing of adds nothing: no round trip
    if (geraet[list].length > 0) {
      const uebrig = await listeUebernehmen(firestore, dokument, geraet, list);
      left[list] = uebrig[list];
    }
  }
  return everyList<SelectionLists>((list) => left[list] ?? []);
}

/**
 * Takes the map `liste` of `geraet` into the account, in a transaction of
 * its own, as the rules check one full map a write.
 */
function listeUebernehmen(
  firestore: Firestore,
  dokument: DocumentReference,
  geraet: AuswahlInhalt,
  liste: AuswahlListe
): Promise<NichtUebernommen> {
  return runTransaction(firestore, async (transaktion) => {
    const gelesen = auswahlDokumentLesen(
      (await transaktion.get(dokument)).data()
    );
    if (gelesen.art === 'neuer') {
      throw new AuswahlZuNeuError();
    }
    const konto = inhaltAus(gelesen);
    const zusammenfuehrung = zusammenfuehren(konto, geraet);
    const felder = auswahlFelder(
      konto,
      { ...konto, [liste]: zusammenfuehrung.inhalt[liste] },
      naechsterSeit(gelesen)
    );
    if (listFields(felder, liste) !== undefined) {
      transaktion.set(dokument, firestoreFelder(felder), { merge: true });
    }
    return zusammenfuehrung.uebrig;
  });
}
