import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  disableNetwork,
  enableNetwork,
  type Firestore,
  waitForPendingWrites,
} from 'firebase/firestore';
import {
  asDevice,
  APP_RULES,
  emulatorProject,
  stored,
  OPEN_RULES,
  withoutRules,
  seed,
} from '../../testing/firestore-emulator';
import {
  contentOf,
  readSelectionDocument,
  type SelectionContent,
  selectionDocumentOf,
  FirestoreSelection,
} from '@wolsok/feat-korbjaeger-selection';
import { selectionContract } from '@wolsok/feat-korbjaeger-selection/testing';

/**
 * `FirestoreSelection` on the emulator: the shared contract of every
 * `Selection` adapter, on rules that let everything through (the contract
 * stores documents the rules would refuse, as a later version or a fault
 * might), and the adapter's own behaviour under the app's rules.
 */

/** How long the open adapters get to hear of the last write. */
const ZUHOEREN_MS = 300;

let vertragsProjekt: RulesTestEnvironment;
let regelProjekt: RulesTestEnvironment;
let naechsteUid = 0;

beforeAll(async () => {
  vertragsProjekt = await emulatorProject(
    'demo-korbjaeger-vertrag',
    OPEN_RULES
  );
  regelProjekt = await emulatorProject('demo-korbjaeger-auswahl', APP_RULES);
});

afterAll(async () => {
  await vertragsProjekt.cleanup();
  await regelProjekt.cleanup();
});

const zuhoeren = () => new Promise((weiter) => setTimeout(weiter, ZUHOEREN_MS));

selectionContract('Firestore', () => {
  // a fresh account per test: its document is the store
  const uid = `vertrag-${naechsteUid++}`;
  const geraete: Firestore[] = [];
  const offen: FirestoreSelection[] = [];
  afterEach(() => offen.forEach((auswahl) => auswahl.stop()));
  const allesGesendet = () =>
    Promise.all(geraete.map((firestore) => waitForPendingWrites(firestore)));
  return {
    open: async () => {
      await allesGesendet();
      const firestore = asDevice(vertragsProjekt, uid);
      geraete.push(firestore);
      const auswahl = new FirestoreSelection(firestore, uid);
      offen.push(auswahl);
      await auswahl.loaded();
      return auswahl;
    },
    writeRaw: (dokument) => seed(vertragsProjekt, uid, dokument),
    // a change resolves once on the device: what it sent is on the server
    // once every device's writes are
    readRaw: async () => {
      await allesGesendet();
      return stored(vertragsProjekt, uid);
    },
    untilSettled: async () => {
      await allesGesendet();
      await zuhoeren();
    },
  };
});

describe('FirestoreSelection', () => {
  const MIMI = { kind: 'named', personId: 4711 } as const;
  const OTTO = { kind: 'named', personId: 4712 } as const;
  const offen: FirestoreSelection[] = [];
  afterEach(() => offen.splice(0).forEach((auswahl) => auswahl.stop()));

  async function oeffnen(
    uid: string,
    firestore = asDevice(regelProjekt, uid)
  ): Promise<FirestoreSelection> {
    const auswahl = new FirestoreSelection(firestore, uid);
    offen.push(auswahl);
    await auswahl.loaded();
    return auswahl;
  }

  /** What the account's stored document holds, as the app reads it. */
  async function gespeicherterInhalt(uid: string): Promise<SelectionContent> {
    const { teams, children, clubColors } = contentOf(
      readSelectionDocument(await stored(regelProjekt, uid))
    );
    return { teams, children, clubColors };
  }

  it("writes what the app's rules take, entry by entry", async () => {
    const uid = 'regeln-schreiben';
    const firestore = asDevice(regelProjekt, uid);
    const auswahl = await oeffnen(uid, firestore);

    await auswahl.follow(313036);
    await auswahl.mark(MIMI, 'Mimi');
    await auswahl.setNickname(MIMI.personId, 'Mi');
    await waitForPendingWrites(firestore);
    expect((await gespeicherterInhalt(uid)).children).toEqual([
      { personId: MIMI.personId, nickname: 'Mi' },
    ]);
    await auswahl.setNickname(MIMI.personId, undefined);
    await waitForPendingWrites(firestore);
    expect((await gespeicherterInhalt(uid)).children).toEqual([
      { personId: MIMI.personId },
    ]);
    await auswahl.follow(201500);
    await auswahl.unfollow(313036);
    await auswahl.mark(OTTO);
    await auswahl.unmark(MIMI.personId);
    // every write was taken: a refused one would be gone again
    await waitForPendingWrites(firestore);

    expect(await stored(regelProjekt, uid)).toEqual({
      version: 3,
      teams: { 201500: expect.any(Number) },
      children: { [OTTO.personId]: { since: expect.any(Number) } },
    });
  });

  it('keeps both of two changes made at once, in their order', async () => {
    const uid = 'zugleich';
    const firestore = asDevice(regelProjekt, uid);
    const auswahl = await oeffnen(uid, firestore);

    await Promise.all([
      auswahl.follow(313036),
      auswahl.follow(201500),
      auswahl.mark(MIMI),
    ]);
    await waitForPendingWrites(firestore);

    expect(auswahl.teams()).toEqual([313036, 201500]);
    expect(await gespeicherterInhalt(uid)).toEqual({
      teams: [313036, 201500],
      children: [{ personId: 4711 }],
      clubColors: [],
    });
  });

  it('changes offline at once, each change on the one before, and sends them once online', async () => {
    const uid = 'offline';
    const firestore = asDevice(regelProjekt, uid);
    const auswahl = await oeffnen(uid, firestore);
    await auswahl.follow(313036);
    await waitForPendingWrites(firestore);
    await disableNetwork(firestore);

    await auswahl.follow(201500);
    await auswahl.mark(MIMI);
    expect(auswahl.teams()).toEqual([313036, 201500]);
    expect(await gespeicherterInhalt(uid)).toEqual({
      teams: [313036],
      children: [],
      clubColors: [],
    });

    await enableNetwork(firestore);
    await waitForPendingWrites(firestore);
    expect(await gespeicherterInhalt(uid)).toEqual({
      teams: [313036, 201500],
      children: [{ personId: 4711 }],
      clubColors: [],
    });
  });

  describe('offline on one device while another changes the document', () => {
    /** Device A, which goes offline, and device B, online throughout. */
    async function zweiGeraete(uid: string) {
      const geraetA = asDevice(regelProjekt, uid);
      const geraetB = asDevice(regelProjekt, uid);
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
      await a.follow(313036);
      await offline();

      await a.follow(201500);
      await b.follow(201765);
      await wiederOnline();

      expect(await gespeicherterInhalt(uid)).toEqual({
        teams: [313036, 201500, 201765],
        children: [],
        clubColors: [],
      });
      expect(a.teams()).toEqual([313036, 201500, 201765]);
    });

    it('keeps the Kind each of them marks, and a Spitzname changed offline in its place', async () => {
      const uid = 'offline-zwei-kinder';
      const { a, b, offline, wiederOnline } = await zweiGeraete(uid);
      await a.mark(MIMI, 'Mimi');
      await offline();

      await a.setNickname(MIMI.personId, 'Mi');
      await b.mark(OTTO);
      await wiederOnline();

      expect(await gespeicherterInhalt(uid)).toEqual({
        teams: [],
        children: [{ personId: 4711, nickname: 'Mi' }, { personId: 4712 }],
        clubColors: [],
      });
    });

    it('keeps what the other adds when one removes offline', async () => {
      const uid = 'offline-entfernen';
      const { a, b, offline, wiederOnline } = await zweiGeraete(uid);
      await a.follow(313036);
      await a.mark(MIMI);
      await offline();

      await a.unfollow(313036);
      await a.unmark(MIMI.personId);
      await b.follow(201765);
      await b.mark(OTTO);
      await wiederOnline();

      expect(await gespeicherterInhalt(uid)).toEqual({
        teams: [201765],
        children: [{ personId: 4712 }],
        clubColors: [],
      });
    });

    it('unmarks a Kind offline whose Spitzname the other changes meanwhile', async () => {
      const uid = 'offline-entmarkieren-spitzname';
      const { a, b, offline, bGesendet, wiederOnline } = await zweiGeraete(uid);
      await a.mark(MIMI, 'Mimi');
      await offline();

      await a.unmark(MIMI.personId);
      await b.setNickname(MIMI.personId, 'Mi');
      await bGesendet();
      await wiederOnline();

      expect(await gespeicherterInhalt(uid)).toEqual({
        teams: [],
        children: [],
        clubColors: [],
      });
    });

    it("refuses the other's Spitzname for a Kind unmarked offline and sent first", async () => {
      const uid = 'offline-zuerst-entmarkiert';
      const { a, b, offline, bGesendet, wiederOnline } = await zweiGeraete(uid);
      await a.mark(MIMI, 'Mimi');
      await offline();
      await a.unmark(MIMI.personId);
      await wiederOnline();

      // B still shows the Kind, as its listener may not have heard yet
      await b.setNickname(MIMI.personId, 'Mi').catch(() => undefined);
      await bGesendet();

      expect(await gespeicherterInhalt(uid)).toEqual({
        teams: [],
        children: [],
        clubColors: [],
      });
    });

    it('refuses, rather than cuts, a Team the other filled the last place for', async () => {
      const uid = 'offline-voll';
      const vorher = Array.from({ length: 49 }, (_, i) => 300000 + i);
      await seed(regelProjekt, uid, {
        version: 3,
        teams: Object.fromEntries(vorher.map((id, i) => [id, i + 1])),
      });
      const { a, b, offline, wiederOnline } = await zweiGeraete(uid);
      await offline();

      await a.follow(201500);
      await b.follow(201765);
      await wiederOnline();

      expect(await gespeicherterInhalt(uid)).toEqual({
        teams: [...vorher, 201765],
        children: [],
        clubColors: [],
      });
      expect(a.teams()).toEqual([...vorher, 201765]);
    });
  });

  it('keeps the changes two devices make at the same time', async () => {
    const uid = 'zwei-geraete';
    const geraete = [asDevice(regelProjekt, uid), asDevice(regelProjekt, uid)];
    const erstes = await oeffnen(uid, geraete[0]);
    const zweites = await oeffnen(uid, geraete[1]);

    await Promise.all([
      erstes.follow(313036),
      zweites.follow(201500),
      erstes.mark(MIMI),
      zweites.follow(201765),
    ]);
    await Promise.all(geraete.map((geraet) => waitForPendingWrites(geraet)));

    const { teams } = await gespeicherterInhalt(uid);
    expect([...teams].sort((a, b) => a - b)).toEqual([201500, 201765, 313036]);
  });

  it('shows a change at once, before the server confirms it', async () => {
    const uid = 'sofort';
    const auswahl = await oeffnen(uid);
    await auswahl.follow(313036);

    const gefolgt = auswahl.follow(201500);

    expect(auswahl.teams()).toEqual([313036, 201500]);
    await gefolgt;
  });

  it("merges a change made offline by a device that never read the account's document", async () => {
    const uid = 'nie-gelesen';
    await seed(regelProjekt, uid, { version: 3, teams: { 313036: 1 } });
    const firestore = asDevice(regelProjekt, uid);
    await disableNetwork(firestore);
    const auswahl = await oeffnen(uid, firestore);

    await auswahl.follow(201500);
    await enableNetwork(firestore);
    await waitForPendingWrites(firestore);

    expect(await gespeicherterInhalt(uid)).toEqual({
      teams: [313036, 201500],
      children: [],
      clubColors: [],
    });
  });

  it("can't be read, and says so, where the rules refuse it", async () => {
    let gehoert: unknown;
    const auswahl = new FirestoreSelection(
      asDevice(regelProjekt, 'regeln-fremd'),
      'regeln-andere',
      { onError: (fehler) => (gehoert = fehler) }
    );
    offen.push(auswahl);

    await expect(auswahl.loaded()).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(auswahl.unreadable()).toBe(true);
    expect(auswahl.teams()).toBeUndefined();
    expect(gehoert).toMatchObject({ code: 'permission-denied' });
  });

  it('shows the selection gone once the document is deleted', async () => {
    const uid = 'regeln-geloescht';
    const firestore = asDevice(regelProjekt, uid);
    const auswahl = await oeffnen(uid, firestore);
    await auswahl.follow(313036);
    await waitForPendingWrites(firestore);

    await withoutRules(regelProjekt, (firestore) =>
      deleteDoc(selectionDocumentOf(firestore, uid))
    );
    await zuhoeren();

    expect(auswahl.teams()).toEqual([]);
  });
});
