import { type Firestore, runTransaction } from 'firebase/firestore';
import { inhaltAus } from './auswahl-aenderungen';
import {
  AUSWAHL_VERSION,
  auswahlDokumentLesen,
  type AuswahlInhalt,
} from './auswahl-dokument';
import { AuswahlZuNeuError } from './auswahl-fehler';
import { auswahlDokumentVon } from './firestore-auswahl';
import { type NichtUebernommen, zusammenfuehren } from './zusammenfuehren';

/** The lists of an `AuswahlDokument`, each taken over on its own. */
const LISTEN = ['teams', 'kinder'] as const;

/**
 * Takes `geraet`, the choices made on the device, into the account `uid`
 * at sign-in, as `zusammenfuehren` joins them: on every sign-in, since a
 * second one with the same choices changes nothing. One transaction a
 * list, as the rules check one list a write; a list the device adds
 * nothing to is not written. Only what fits under the caps joins; resolves
 * with how many of the device's Teams and Kinder did not. Rejects with
 * `AuswahlZuNeuError` where a newer version of the app stored the
 * account's selection, which it leaves alone.
 */
export async function geraetUebernehmen(
  firestore: Firestore,
  uid: string,
  geraet: AuswahlInhalt
): Promise<NichtUebernommen> {
  const dokument = auswahlDokumentVon(firestore, uid);
  const uebrig = { teams: 0, kinder: 0 };
  for (const liste of LISTEN) {
    uebrig[liste] = await runTransaction(firestore, async (transaktion) => {
      const gelesen = auswahlDokumentLesen(
        (await transaktion.get(dokument)).data()
      );
      if (gelesen.art === 'neuer') {
        throw new AuswahlZuNeuError();
      }
      const konto = inhaltAus(gelesen);
      const zusammenfuehrung = zusammenfuehren(konto, geraet);
      const zusammen = zusammenfuehrung.inhalt[liste];
      if (gelesen.art === 'aktuell' && zusammen === konto[liste]) {
        return zusammenfuehrung.uebrig[liste];
      }
      // a document without its Teams is none: a new one gets both lists
      const teile =
        gelesen.art === 'aktuell'
          ? { [liste]: zusammen }
          : { ...konto, [liste]: zusammen };
      transaktion.set(
        dokument,
        { version: AUSWAHL_VERSION, ...teile },
        { merge: true }
      );
      return zusammenfuehrung.uebrig[liste];
    });
  }
  return uebrig;
}
