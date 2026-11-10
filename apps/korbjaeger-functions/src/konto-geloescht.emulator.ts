import { assertSucceeds } from '@firebase/rules-unit-testing';
import { Timestamp } from 'firebase-admin/firestore';
import {
  DELETED_ACCOUNTS_COLLECTION,
  CHOICES_COLLECTION,
  TOMBSTONE_DURATION_MS,
} from '@wolsok/feat-shared-korbjaeger-account';
import { kontoGeloescht } from './konto-geloescht';
import { useEmulatorProject } from './testing/emulator';

const ELTERNTEIL = 'elternteil-a';
const ANDERES = 'elternteil-b';
const JETZT = Date.UTC(2026, 10, 9, 12);

const AUSWAHL_DOKUMENT = {
  version: 3,
  teams: { 313036: 1 },
  children: { 4711: { since: 1, nickname: 'Mimi' } },
};

const project = useEmulatorProject();

const auswahlVon = (uid: string) =>
  project().admin.collection(CHOICES_COLLECTION).doc(uid);

const grabsteinVon = (uid: string) =>
  project().admin.collection(DELETED_ACCOUNTS_COLLECTION).doc(uid);

/** A device signed in as `uid`, under the app's rules. */
const geraet = (uid: string) =>
  project().devices.authenticatedContext(uid).firestore();

/** What a device writes when the Elternteil follows the Team `id`. */
const folgen = (device: ReturnType<typeof geraet>, uid: string, id: number) =>
  device
    .collection(CHOICES_COLLECTION)
    .doc(uid)
    .set({ version: 3, teams: { [id]: id } }, { merge: true });

describe('kontoGeloescht', () => {
  it('leaves a tombstone of a day and no Auswahl of the account', async () => {
    await auswahlVon(ELTERNTEIL).set(AUSWAHL_DOKUMENT);

    await kontoGeloescht(project().admin, ELTERNTEIL, JETZT);

    expect((await auswahlVon(ELTERNTEIL).get()).exists).toBe(false);
    expect((await grabsteinVon(ELTERNTEIL).get()).data()).toEqual({
      expireAt: Timestamp.fromMillis(JETZT + TOMBSTONE_DURATION_MS),
    });
  });

  it("leaves other accounts' Auswahl as it is", async () => {
    await auswahlVon(ANDERES).set(AUSWAHL_DOKUMENT);

    await kontoGeloescht(project().admin, ELTERNTEIL, JETZT);

    expect((await auswahlVon(ANDERES).get()).data()).toEqual(AUSWAHL_DOKUMENT);
    expect((await grabsteinVon(ANDERES).get()).exists).toBe(false);
  });

  it('ends the same on a retry after it succeeded', async () => {
    await auswahlVon(ELTERNTEIL).set(AUSWAHL_DOKUMENT);
    await kontoGeloescht(project().admin, ELTERNTEIL, JETZT);

    await kontoGeloescht(project().admin, ELTERNTEIL, JETZT);

    expect((await auswahlVon(ELTERNTEIL).get()).exists).toBe(false);
    expect((await grabsteinVon(ELTERNTEIL).get()).exists).toBe(true);
  });

  it('ends the same on a retry after it failed between its steps', async () => {
    await auswahlVon(ELTERNTEIL).set(AUSWAHL_DOKUMENT);
    // the tombstone was written, the deletion failed
    await grabsteinVon(ELTERNTEIL).set({ expireAt: Timestamp.fromMillis(1) });

    await kontoGeloescht(project().admin, ELTERNTEIL, JETZT);

    expect((await auswahlVon(ELTERNTEIL).get()).exists).toBe(false);
    expect((await grabsteinVon(ELTERNTEIL).get()).data()).toEqual({
      expireAt: Timestamp.fromMillis(JETZT + TOMBSTONE_DURATION_MS),
    });
  });

  // #2912: a second device signed in to the account keeps its token for up
  // to an hour after the deletion and may write the whole time
  it('leaves nothing while a second device of the account keeps writing', async () => {
    await auswahlVon(ELTERNTEIL).set(AUSWAHL_DOKUMENT);
    const loeschendes = geraet(ELTERNTEIL);
    const anderes = geraet(ELTERNTEIL);
    let geloescht = false;
    const nachDerLoeschung: boolean[] = [];
    let ersteGespeichert!: () => void;
    const einmalGespeichert = new Promise<void>((r) => (ersteGespeichert = r));

    // the deleting device deletes the document; the other one writes it anew
    await assertSucceeds(
      loeschendes.collection(CHOICES_COLLECTION).doc(ELTERNTEIL).delete()
    );
    await assertSucceeds(folgen(anderes, ELTERNTEIL, 99));
    expect((await auswahlVon(ELTERNTEIL).get()).exists).toBe(true);

    // and keeps writing while the Auth deletion's trigger runs, and after
    const schreiben = (async () => {
      for (let id = 100; nachDerLoeschung.length < 5; id++) {
        const danach = geloescht;
        const gespeichert = await folgen(anderes, ELTERNTEIL, id).then(
          () => true,
          () => false
        );
        if (danach) {
          nachDerLoeschung.push(gespeichert);
        } else if (gespeichert) {
          ersteGespeichert();
        }
      }
    })();
    await einmalGespeichert;
    await kontoGeloescht(project().admin, ELTERNTEIL, JETZT);
    geloescht = true;
    await schreiben;

    expect(nachDerLoeschung).toEqual([false, false, false, false, false]);
    expect((await auswahlVon(ELTERNTEIL).get()).exists).toBe(false);
  });
});
