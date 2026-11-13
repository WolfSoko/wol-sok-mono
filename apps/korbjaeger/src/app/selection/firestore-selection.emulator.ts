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
const LISTEN_MS = 300;

let contractProject: RulesTestEnvironment;
let rulesProject: RulesTestEnvironment;
let nextUid = 0;

beforeAll(async () => {
  contractProject = await emulatorProject(
    'demo-korbjaeger-vertrag',
    OPEN_RULES
  );
  rulesProject = await emulatorProject('demo-korbjaeger-auswahl', APP_RULES);
});

afterAll(async () => {
  await contractProject.cleanup();
  await rulesProject.cleanup();
});

const listen = () => new Promise((proceed) => setTimeout(proceed, LISTEN_MS));

selectionContract('Firestore', () => {
  // a fresh account per test: its document is the store
  const uid = `vertrag-${nextUid++}`;
  const devices: Firestore[] = [];
  const openSelections: FirestoreSelection[] = [];
  afterEach(() => openSelections.forEach((selection) => selection.stop()));
  const allSent = () =>
    Promise.all(devices.map((firestore) => waitForPendingWrites(firestore)));
  return {
    open: async () => {
      await allSent();
      const firestore = asDevice(contractProject, uid);
      devices.push(firestore);
      const selection = new FirestoreSelection(firestore, uid);
      openSelections.push(selection);
      await selection.loaded();
      return selection;
    },
    writeRaw: (storedDocument) => seed(contractProject, uid, storedDocument),
    // a change resolves once on the device: what it sent is on the server
    // once every device's writes are
    readRaw: async () => {
      await allSent();
      return stored(contractProject, uid);
    },
    untilSettled: async () => {
      await allSent();
      await listen();
    },
  };
});

describe('FirestoreSelection', () => {
  const MIMI = { kind: 'named', personId: 4711 } as const;
  const OTTO = { kind: 'named', personId: 4712 } as const;
  const openSelections: FirestoreSelection[] = [];
  afterEach(() =>
    openSelections.splice(0).forEach((selection) => selection.stop())
  );

  async function openSelection(
    uid: string,
    firestore = asDevice(rulesProject, uid)
  ): Promise<FirestoreSelection> {
    const selection = new FirestoreSelection(firestore, uid);
    openSelections.push(selection);
    await selection.loaded();
    return selection;
  }

  /** What the account's stored document holds, as the app reads it. */
  async function storedContent(uid: string): Promise<SelectionContent> {
    const { teams, children, clubColors } = contentOf(
      readSelectionDocument(await stored(rulesProject, uid))
    );
    return { teams, children, clubColors };
  }

  it("writes what the app's rules take, entry by entry", async () => {
    const uid = 'regeln-schreiben';
    const firestore = asDevice(rulesProject, uid);
    const selection = await openSelection(uid, firestore);

    await selection.follow(313036);
    await selection.mark(MIMI, 'Mimi');
    await selection.setNickname(MIMI.personId, 'Mi');
    await waitForPendingWrites(firestore);
    expect((await storedContent(uid)).children).toEqual([
      { personId: MIMI.personId, nickname: 'Mi' },
    ]);
    await selection.setNickname(MIMI.personId, undefined);
    await waitForPendingWrites(firestore);
    expect((await storedContent(uid)).children).toEqual([
      { personId: MIMI.personId },
    ]);
    await selection.follow(201500);
    await selection.unfollow(313036);
    await selection.mark(OTTO);
    await selection.unmark(MIMI.personId);
    // every write was taken: a refused one would be gone again
    await waitForPendingWrites(firestore);

    expect(await stored(rulesProject, uid)).toEqual({
      version: 3,
      teams: { 201500: expect.any(Number) },
      children: { [OTTO.personId]: { since: expect.any(Number) } },
    });
  });

  it('keeps both of two changes made at once, in their order', async () => {
    const uid = 'zugleich';
    const firestore = asDevice(rulesProject, uid);
    const selection = await openSelection(uid, firestore);

    await Promise.all([
      selection.follow(313036),
      selection.follow(201500),
      selection.mark(MIMI),
    ]);
    await waitForPendingWrites(firestore);

    expect(selection.teams()).toEqual([313036, 201500]);
    expect(await storedContent(uid)).toEqual({
      teams: [313036, 201500],
      children: [{ personId: 4711 }],
      clubColors: [],
    });
  });

  it('changes offline at once, each change on the one before, and sends them once online', async () => {
    const uid = 'offline';
    const firestore = asDevice(rulesProject, uid);
    const selection = await openSelection(uid, firestore);
    await selection.follow(313036);
    await waitForPendingWrites(firestore);
    await disableNetwork(firestore);

    await selection.follow(201500);
    await selection.mark(MIMI);
    expect(selection.teams()).toEqual([313036, 201500]);
    expect(await storedContent(uid)).toEqual({
      teams: [313036],
      children: [],
      clubColors: [],
    });

    await enableNetwork(firestore);
    await waitForPendingWrites(firestore);
    expect(await storedContent(uid)).toEqual({
      teams: [313036, 201500],
      children: [{ personId: 4711 }],
      clubColors: [],
    });
  });

  describe('offline on one device while another changes the document', () => {
    /** Device A, which goes offline, and device B, online throughout. */
    async function twoDevices(uid: string) {
      const deviceA = asDevice(rulesProject, uid);
      const deviceB = asDevice(rulesProject, uid);
      const a = await openSelection(uid, deviceA);
      const b = await openSelection(uid, deviceB);
      return {
        a,
        b,
        offline: async () => {
          await waitForPendingWrites(deviceA);
          await listen();
          await disableNetwork(deviceA);
        },
        bSent: () => waitForPendingWrites(deviceB),
        backOnline: async () => {
          await waitForPendingWrites(deviceB);
          await enableNetwork(deviceA);
          await waitForPendingWrites(deviceA).catch(() => undefined);
          await listen();
        },
      };
    }

    it('keeps the Team each of them follows', async () => {
      const uid = 'offline-zwei-teams';
      const { a, b, offline, backOnline } = await twoDevices(uid);
      await a.follow(313036);
      await offline();

      await a.follow(201500);
      await b.follow(201765);
      await backOnline();

      expect(await storedContent(uid)).toEqual({
        teams: [313036, 201500, 201765],
        children: [],
        clubColors: [],
      });
      expect(a.teams()).toEqual([313036, 201500, 201765]);
    });

    it('keeps the Kind each of them marks, and a Spitzname changed offline in its place', async () => {
      const uid = 'offline-zwei-kinder';
      const { a, b, offline, backOnline } = await twoDevices(uid);
      await a.mark(MIMI, 'Mimi');
      await offline();

      await a.setNickname(MIMI.personId, 'Mi');
      await b.mark(OTTO);
      await backOnline();

      expect(await storedContent(uid)).toEqual({
        teams: [],
        children: [{ personId: 4711, nickname: 'Mi' }, { personId: 4712 }],
        clubColors: [],
      });
    });

    it('keeps what the other adds when one removes offline', async () => {
      const uid = 'offline-entfernen';
      const { a, b, offline, backOnline } = await twoDevices(uid);
      await a.follow(313036);
      await a.mark(MIMI);
      await offline();

      await a.unfollow(313036);
      await a.unmark(MIMI.personId);
      await b.follow(201765);
      await b.mark(OTTO);
      await backOnline();

      expect(await storedContent(uid)).toEqual({
        teams: [201765],
        children: [{ personId: 4712 }],
        clubColors: [],
      });
    });

    it('unmarks a Kind offline whose Spitzname the other changes meanwhile', async () => {
      const uid = 'offline-entmarkieren-spitzname';
      const { a, b, offline, bSent, backOnline } = await twoDevices(uid);
      await a.mark(MIMI, 'Mimi');
      await offline();

      await a.unmark(MIMI.personId);
      await b.setNickname(MIMI.personId, 'Mi');
      await bSent();
      await backOnline();

      expect(await storedContent(uid)).toEqual({
        teams: [],
        children: [],
        clubColors: [],
      });
    });

    it("refuses the other's Spitzname for a Kind unmarked offline and sent first", async () => {
      const uid = 'offline-zuerst-entmarkiert';
      const { a, b, offline, bSent, backOnline } = await twoDevices(uid);
      await a.mark(MIMI, 'Mimi');
      await offline();
      await a.unmark(MIMI.personId);
      await backOnline();

      // B still shows the Kind, as its listener may not have heard yet
      await b.setNickname(MIMI.personId, 'Mi').catch(() => undefined);
      await bSent();

      expect(await storedContent(uid)).toEqual({
        teams: [],
        children: [],
        clubColors: [],
      });
    });

    it('refuses, rather than cuts, a Team the other filled the last place for', async () => {
      const uid = 'offline-voll';
      const before = Array.from({ length: 49 }, (_, i) => 300000 + i);
      await seed(rulesProject, uid, {
        version: 3,
        teams: Object.fromEntries(before.map((id, i) => [id, i + 1])),
      });
      const { a, b, offline, backOnline } = await twoDevices(uid);
      await offline();

      await a.follow(201500);
      await b.follow(201765);
      await backOnline();

      expect(await storedContent(uid)).toEqual({
        teams: [...before, 201765],
        children: [],
        clubColors: [],
      });
      expect(a.teams()).toEqual([...before, 201765]);
    });
  });

  it('keeps the changes two devices make at the same time', async () => {
    const uid = 'zwei-geraete';
    const devices = [asDevice(rulesProject, uid), asDevice(rulesProject, uid)];
    const first = await openSelection(uid, devices[0]);
    const second = await openSelection(uid, devices[1]);

    await Promise.all([
      first.follow(313036),
      second.follow(201500),
      first.mark(MIMI),
      second.follow(201765),
    ]);
    await Promise.all(devices.map((device) => waitForPendingWrites(device)));

    const { teams } = await storedContent(uid);
    expect([...teams].sort((a, b) => a - b)).toEqual([201500, 201765, 313036]);
  });

  it('shows a change at once, before the server confirms it', async () => {
    const uid = 'sofort';
    const selection = await openSelection(uid);
    await selection.follow(313036);

    const followed = selection.follow(201500);

    expect(selection.teams()).toEqual([313036, 201500]);
    await followed;
  });

  it("merges a change made offline by a device that never read the account's document", async () => {
    const uid = 'nie-gelesen';
    await seed(rulesProject, uid, { version: 3, teams: { 313036: 1 } });
    const firestore = asDevice(rulesProject, uid);
    await disableNetwork(firestore);
    const selection = await openSelection(uid, firestore);

    await selection.follow(201500);
    await enableNetwork(firestore);
    await waitForPendingWrites(firestore);

    expect(await storedContent(uid)).toEqual({
      teams: [313036, 201500],
      children: [],
      clubColors: [],
    });
  });

  it("can't be read, and says so, where the rules refuse it", async () => {
    let heard: unknown;
    const selection = new FirestoreSelection(
      asDevice(rulesProject, 'regeln-fremd'),
      'regeln-andere',
      { onError: (error) => (heard = error) }
    );
    openSelections.push(selection);

    await expect(selection.loaded()).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(selection.unreadable()).toBe(true);
    expect(selection.teams()).toBeUndefined();
    expect(heard).toMatchObject({ code: 'permission-denied' });
  });

  it('shows the selection gone once the document is deleted', async () => {
    const uid = 'regeln-geloescht';
    const firestore = asDevice(rulesProject, uid);
    const selection = await openSelection(uid, firestore);
    await selection.follow(313036);
    await waitForPendingWrites(firestore);

    await withoutRules(rulesProject, (firestore) =>
      deleteDoc(selectionDocumentOf(firestore, uid))
    );
    await listen();

    expect(selection.teams()).toEqual([]);
  });
});
