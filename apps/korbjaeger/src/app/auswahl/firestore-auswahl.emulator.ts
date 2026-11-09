import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  disableNetwork,
  enableNetwork,
  type Firestore,
  waitForPendingWrites,
} from 'firebase/firestore';
import {
  alsGeraet,
  APP_REGELN,
  emulatorProjekt,
  gespeichert,
  OFFENE_REGELN,
  ohneRegeln,
  vorhanden,
} from '../../testing/firestore-emulator';
import {
  inhaltAus,
  auswahlDokumentLesen,
  type AuswahlInhalt,
  auswahlDokumentVon,
  FirestoreAuswahl,
} from '@wolsok/feat-korbjaeger-auswahl';
import { auswahlVertrag } from '@wolsok/feat-korbjaeger-auswahl/testing';

/**
 * `FirestoreAuswahl` on the emulator: the shared contract of every
 * `Auswahl` adapter, on rules that let everything through (the contract
 * stores documents the rules would refuse, as a later version or a fault
 * might), and the adapter's own behaviour under the app's rules.
 */

/** How long the open adapters get to hear of the last write. */
const ZUHOEREN_MS = 300;

let vertragsProjekt: RulesTestEnvironment;
let regelProjekt: RulesTestEnvironment;
let naechsteUid = 0;

beforeAll(async () => {
  vertragsProjekt = await emulatorProjekt(
    'demo-korbjaeger-vertrag',
    OFFENE_REGELN
  );
  regelProjekt = await emulatorProjekt('demo-korbjaeger-auswahl', APP_REGELN);
});

afterAll(async () => {
  await vertragsProjekt.cleanup();
  await regelProjekt.cleanup();
});

const zuhoeren = () => new Promise((weiter) => setTimeout(weiter, ZUHOEREN_MS));

auswahlVertrag('Firestore', () => {
  // a fresh account per test: its document is the store
  const uid = `vertrag-${naechsteUid++}`;
  const geraete: Firestore[] = [];
  const offen: FirestoreAuswahl[] = [];
  afterEach(() => offen.forEach((auswahl) => auswahl.beenden()));
  const allesGesendet = () =>
    Promise.all(geraete.map((firestore) => waitForPendingWrites(firestore)));
  return {
    oeffnen: async () => {
      await allesGesendet();
      const firestore = alsGeraet(vertragsProjekt, uid);
      geraete.push(firestore);
      const auswahl = new FirestoreAuswahl(firestore, uid);
      offen.push(auswahl);
      await auswahl.geladen();
      return auswahl;
    },
    schreibeRoh: (dokument) => vorhanden(vertragsProjekt, uid, dokument),
    // a change resolves once on the device: what it sent is on the server
    // once every device's writes are
    liesRoh: async () => {
      await allesGesendet();
      return gespeichert(vertragsProjekt, uid);
    },
    bisStabil: async () => {
      await allesGesendet();
      await zuhoeren();
    },
  };
});

describe('FirestoreAuswahl', () => {
  const MIMI = { art: 'benannt', personId: 4711 } as const;
  const OTTO = { art: 'benannt', personId: 4712 } as const;
  const offen: FirestoreAuswahl[] = [];
  afterEach(() => offen.splice(0).forEach((auswahl) => auswahl.beenden()));

  async function oeffnen(
    uid: string,
    firestore = alsGeraet(regelProjekt, uid)
  ): Promise<FirestoreAuswahl> {
    const auswahl = new FirestoreAuswahl(firestore, uid);
    offen.push(auswahl);
    await auswahl.geladen();
    return auswahl;
  }

  /** What the account's stored document holds, as the app reads it. */
  async function gespeicherterInhalt(uid: string): Promise<AuswahlInhalt> {
    const { teams, kinder, vereinsfarben } = inhaltAus(
      auswahlDokumentLesen(await gespeichert(regelProjekt, uid))
    );
    return { teams, kinder, vereinsfarben };
  }

  it("writes what the app's rules take, entry by entry", async () => {
    const uid = 'regeln-schreiben';
    const firestore = alsGeraet(regelProjekt, uid);
    const auswahl = await oeffnen(uid, firestore);

    await auswahl.folgen(313036);
    await auswahl.markieren(MIMI, 'Mimi');
    await auswahl.spitznameSetzen(MIMI.personId, 'Mi');
    await waitForPendingWrites(firestore);
    expect((await gespeicherterInhalt(uid)).kinder).toEqual([
      { personId: MIMI.personId, spitzname: 'Mi' },
    ]);
    await auswahl.spitznameSetzen(MIMI.personId, undefined);
    await waitForPendingWrites(firestore);
    expect((await gespeicherterInhalt(uid)).kinder).toEqual([
      { personId: MIMI.personId },
    ]);
    await auswahl.folgen(201500);
    await auswahl.entfolgen(313036);
    await auswahl.markieren(OTTO);
    await auswahl.entmarkieren(MIMI.personId);
    // every write was taken: a refused one would be gone again
    await waitForPendingWrites(firestore);

    expect(await gespeichert(regelProjekt, uid)).toEqual({
      version: 2,
      teams: { 201500: expect.any(Number) },
      kinder: { [OTTO.personId]: { seit: expect.any(Number) } },
    });
  });

  it('keeps both of two changes made at once, in their order', async () => {
    const uid = 'zugleich';
    const firestore = alsGeraet(regelProjekt, uid);
    const auswahl = await oeffnen(uid, firestore);

    await Promise.all([
      auswahl.folgen(313036),
      auswahl.folgen(201500),
      auswahl.markieren(MIMI),
    ]);
    await waitForPendingWrites(firestore);

    expect(auswahl.teams()).toEqual([313036, 201500]);
    expect(await gespeicherterInhalt(uid)).toEqual({
      teams: [313036, 201500],
      kinder: [{ personId: 4711 }],
      vereinsfarben: [],
    });
  });

  it('changes offline at once, each change on the one before, and sends them once online', async () => {
    const uid = 'offline';
    const firestore = alsGeraet(regelProjekt, uid);
    const auswahl = await oeffnen(uid, firestore);
    await auswahl.folgen(313036);
    await waitForPendingWrites(firestore);
    await disableNetwork(firestore);

    await auswahl.folgen(201500);
    await auswahl.markieren(MIMI);
    expect(auswahl.teams()).toEqual([313036, 201500]);
    expect(await gespeicherterInhalt(uid)).toEqual({
      teams: [313036],
      kinder: [],
      vereinsfarben: [],
    });

    await enableNetwork(firestore);
    await waitForPendingWrites(firestore);
    expect(await gespeicherterInhalt(uid)).toEqual({
      teams: [313036, 201500],
      kinder: [{ personId: 4711 }],
      vereinsfarben: [],
    });
  });

  describe('offline on one device while another changes the document', () => {
    /** Device A, which goes offline, and device B, online throughout. */
    async function zweiGeraete(uid: string) {
      const geraetA = alsGeraet(regelProjekt, uid);
      const geraetB = alsGeraet(regelProjekt, uid);
      const a = await oeffnen(uid, geraetA);
      const b = await oeffnen(uid, geraetB);
      return {
        a,
        b,
        offline: async () => {
          await waitForPendingWrites(geraetA);
          await zuhoeren();
          await disableNetwork(geraetA);
        },
        bGesendet: () => waitForPendingWrites(geraetB),
        wiederOnline: async () => {
          await waitForPendingWrites(geraetB);
          await enableNetwork(geraetA);
          await waitForPendingWrites(geraetA).catch(() => undefined);
          await zuhoeren();
        },
      };
    }

    it('keeps the Team each of them follows', async () => {
      const uid = 'offline-zwei-teams';
      const { a, b, offline, wiederOnline } = await zweiGeraete(uid);
      await a.folgen(313036);
      await offline();

      await a.folgen(201500);
      await b.folgen(201765);
      await wiederOnline();

      expect(await gespeicherterInhalt(uid)).toEqual({
        teams: [313036, 201500, 201765],
        kinder: [],
        vereinsfarben: [],
      });
      expect(a.teams()).toEqual([313036, 201500, 201765]);
    });

    it('keeps the Kind each of them marks, and a Spitzname changed offline in its place', async () => {
      const uid = 'offline-zwei-kinder';
      const { a, b, offline, wiederOnline } = await zweiGeraete(uid);
      await a.markieren(MIMI, 'Mimi');
      await offline();

      await a.spitznameSetzen(MIMI.personId, 'Mi');
      await b.markieren(OTTO);
      await wiederOnline();

      expect(await gespeicherterInhalt(uid)).toEqual({
        teams: [],
        kinder: [{ personId: 4711, spitzname: 'Mi' }, { personId: 4712 }],
        vereinsfarben: [],
      });
    });

    it('keeps what the other adds when one removes offline', async () => {
      const uid = 'offline-entfernen';
      const { a, b, offline, wiederOnline } = await zweiGeraete(uid);
      await a.folgen(313036);
      await a.markieren(MIMI);
      await offline();

      await a.entfolgen(313036);
      await a.entmarkieren(MIMI.personId);
      await b.folgen(201765);
      await b.markieren(OTTO);
      await wiederOnline();

      expect(await gespeicherterInhalt(uid)).toEqual({
        teams: [201765],
        kinder: [{ personId: 4712 }],
        vereinsfarben: [],
      });
    });

    it('unmarks a Kind offline whose Spitzname the other changes meanwhile', async () => {
      const uid = 'offline-entmarkieren-spitzname';
      const { a, b, offline, bGesendet, wiederOnline } = await zweiGeraete(uid);
      await a.markieren(MIMI, 'Mimi');
      await offline();

      await a.entmarkieren(MIMI.personId);
      await b.spitznameSetzen(MIMI.personId, 'Mi');
      await bGesendet();
      await wiederOnline();

      expect(await gespeicherterInhalt(uid)).toEqual({
        teams: [],
        kinder: [],
        vereinsfarben: [],
      });
    });

    it("refuses the other's Spitzname for a Kind unmarked offline and sent first", async () => {
      const uid = 'offline-zuerst-entmarkiert';
      const { a, b, offline, bGesendet, wiederOnline } = await zweiGeraete(uid);
      await a.markieren(MIMI, 'Mimi');
      await offline();
      await a.entmarkieren(MIMI.personId);
      await wiederOnline();

      // B still shows the Kind, as its listener may not have heard yet
      await b.spitznameSetzen(MIMI.personId, 'Mi').catch(() => undefined);
      await bGesendet();

      expect(await gespeicherterInhalt(uid)).toEqual({
        teams: [],
        kinder: [],
        vereinsfarben: [],
      });
    });

    it('refuses, rather than cuts, a Team the other filled the last place for', async () => {
      const uid = 'offline-voll';
      const vorher = Array.from({ length: 49 }, (_, i) => 300000 + i);
      await vorhanden(regelProjekt, uid, {
        version: 2,
        teams: Object.fromEntries(vorher.map((id, i) => [id, i + 1])),
      });
      const { a, b, offline, wiederOnline } = await zweiGeraete(uid);
      await offline();

      await a.folgen(201500);
      await b.folgen(201765);
      await wiederOnline();

      expect(await gespeicherterInhalt(uid)).toEqual({
        teams: [...vorher, 201765],
        kinder: [],
        vereinsfarben: [],
      });
      expect(a.teams()).toEqual([...vorher, 201765]);
    });
  });

  it('keeps the changes two devices make at the same time', async () => {
    const uid = 'zwei-geraete';
    const geraete = [
      alsGeraet(regelProjekt, uid),
      alsGeraet(regelProjekt, uid),
    ];
    const erstes = await oeffnen(uid, geraete[0]);
    const zweites = await oeffnen(uid, geraete[1]);

    await Promise.all([
      erstes.folgen(313036),
      zweites.folgen(201500),
      erstes.markieren(MIMI),
      zweites.folgen(201765),
    ]);
    await Promise.all(geraete.map((geraet) => waitForPendingWrites(geraet)));

    const { teams } = await gespeicherterInhalt(uid);
    expect([...teams].sort((a, b) => a - b)).toEqual([201500, 201765, 313036]);
  });

  it('shows a change at once, before the server confirms it', async () => {
    const uid = 'sofort';
    const auswahl = await oeffnen(uid);
    await auswahl.folgen(313036);

    const gefolgt = auswahl.folgen(201500);

    expect(auswahl.teams()).toEqual([313036, 201500]);
    await gefolgt;
  });

  it("merges a change made offline by a device that never read the account's document", async () => {
    const uid = 'nie-gelesen';
    await vorhanden(regelProjekt, uid, { version: 2, teams: { 313036: 1 } });
    const firestore = alsGeraet(regelProjekt, uid);
    await disableNetwork(firestore);
    const auswahl = await oeffnen(uid, firestore);

    await auswahl.folgen(201500);
    await enableNetwork(firestore);
    await waitForPendingWrites(firestore);

    expect(await gespeicherterInhalt(uid)).toEqual({
      teams: [313036, 201500],
      kinder: [],
      vereinsfarben: [],
    });
  });

  it("can't be read, and says so, where the rules refuse it", async () => {
    let gehoert: unknown;
    const auswahl = new FirestoreAuswahl(
      alsGeraet(regelProjekt, 'regeln-fremd'),
      'regeln-andere',
      { beiFehler: (fehler) => (gehoert = fehler) }
    );
    offen.push(auswahl);

    await expect(auswahl.geladen()).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(auswahl.nichtLesbar()).toBe(true);
    expect(auswahl.teams()).toBeUndefined();
    expect(gehoert).toMatchObject({ code: 'permission-denied' });
  });

  it('shows the selection gone once the document is deleted', async () => {
    const uid = 'regeln-geloescht';
    const firestore = alsGeraet(regelProjekt, uid);
    const auswahl = await oeffnen(uid, firestore);
    await auswahl.folgen(313036);
    await waitForPendingWrites(firestore);

    await ohneRegeln(regelProjekt, (firestore) =>
      deleteDoc(auswahlDokumentVon(firestore, uid))
    );
    await zuhoeren();

    expect(auswahl.teams()).toEqual([]);
  });
});
