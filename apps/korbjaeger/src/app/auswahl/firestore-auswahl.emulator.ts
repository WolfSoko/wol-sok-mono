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
import { AuswahlOfflineUnbekanntError } from './auswahl-fehler';
import { auswahlDokumentVon, FirestoreAuswahl } from './firestore-auswahl';
import { auswahlVertrag } from './testing/auswahl-vertrag';

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
  return {
    oeffnen: async () => {
      const firestore = alsGeraet(vertragsProjekt, uid);
      geraete.push(firestore);
      const auswahl = new FirestoreAuswahl(firestore, uid);
      offen.push(auswahl);
      await auswahl.geladen();
      return auswahl;
    },
    schreibeRoh: (dokument) => vorhanden(vertragsProjekt, uid, dokument),
    liesRoh: () => gespeichert(vertragsProjekt, uid),
    bisStabil: async () => {
      await Promise.all(
        geraete.map((firestore) => waitForPendingWrites(firestore))
      );
      await zuhoeren();
    },
  };
});

describe('FirestoreAuswahl', () => {
  const MIMI = { art: 'benannt', personId: 4711 } as const;
  const offen: FirestoreAuswahl[] = [];
  afterEach(() => offen.splice(0).forEach((auswahl) => auswahl.beenden()));

  async function oeffnen(
    uid: string,
    optionen: ConstructorParameters<typeof FirestoreAuswahl>[2] = {},
    firestore = alsGeraet(regelProjekt, uid)
  ): Promise<FirestoreAuswahl> {
    const auswahl = new FirestoreAuswahl(firestore, uid, optionen);
    offen.push(auswahl);
    await auswahl.geladen();
    return auswahl;
  }

  it("writes what the app's rules take, list by list", async () => {
    const uid = 'regeln-schreiben';
    const auswahl = await oeffnen(uid);

    await auswahl.folgen(313036);
    await auswahl.markieren(MIMI, 'Mimi');
    await auswahl.spitznameSetzen(MIMI.personId, 'Mi');
    await auswahl.folgen(201500);
    await auswahl.entfolgen(313036);
    await auswahl.entmarkieren(MIMI.personId);

    expect(await gespeichert(regelProjekt, uid)).toEqual({
      version: 1,
      teams: [201500],
      kinder: [],
    });
  });

  it('keeps both of two changes made at once', async () => {
    const uid = 'zugleich';
    const auswahl = await oeffnen(uid);

    await Promise.all([
      auswahl.folgen(313036),
      auswahl.folgen(201500),
      auswahl.markieren(MIMI),
    ]);

    expect(auswahl.teams()).toEqual([313036, 201500]);
    expect(await gespeichert(regelProjekt, uid)).toEqual({
      version: 1,
      teams: [313036, 201500],
      kinder: [{ personId: 4711 }],
    });
  });

  it('changes offline at once, each change on the one before, and sends them once online', async () => {
    const uid = 'offline';
    const firestore = alsGeraet(regelProjekt, uid);
    let online = true;
    const auswahl = await oeffnen(uid, { istOnline: () => online }, firestore);
    await auswahl.folgen(313036);
    await disableNetwork(firestore);
    online = false;

    await auswahl.folgen(201500);
    await auswahl.markieren(MIMI);
    expect(auswahl.teams()).toEqual([313036, 201500]);
    expect(await gespeichert(regelProjekt, uid)).toEqual({
      version: 1,
      teams: [313036],
      kinder: [],
    });

    await enableNetwork(firestore);
    await waitForPendingWrites(firestore);
    expect(await gespeichert(regelProjekt, uid)).toEqual({
      version: 1,
      teams: [313036, 201500],
      kinder: [{ personId: 4711 }],
    });
  });

  it('keeps the changes two devices make at the same time', async () => {
    const uid = 'zwei-geraete';
    const erstes = await oeffnen(uid);
    const zweites = await oeffnen(uid);

    await Promise.all([
      erstes.folgen(313036),
      zweites.folgen(201500),
      erstes.markieren(MIMI),
      zweites.folgen(201765),
    ]);

    const gespeicherteTeams = (
      (await gespeichert(regelProjekt, uid)) as { teams: number[] }
    ).teams;
    expect([...gespeicherteTeams].sort((a, b) => a - b)).toEqual([
      201500, 201765, 313036,
    ]);
  });

  it('shows a change at once, before the server confirms it', async () => {
    const uid = 'sofort';
    const auswahl = await oeffnen(uid);
    await auswahl.folgen(313036);

    const gefolgt = auswahl.folgen(201500);

    expect(auswahl.teams()).toEqual([313036, 201500]);
    await gefolgt;
  });

  it('refuses a change offline where the device never knew the document', async () => {
    const uid = 'nie-gelesen';
    await vorhanden(regelProjekt, uid, {
      version: 1,
      teams: [313036],
      kinder: [],
    });
    const firestore = alsGeraet(regelProjekt, uid);
    await disableNetwork(firestore);
    const auswahl = new FirestoreAuswahl(firestore, uid, {
      istOnline: () => false,
    });
    offen.push(auswahl);
    await auswahl.geladen();

    await expect(auswahl.folgen(201500)).rejects.toBeInstanceOf(
      AuswahlOfflineUnbekanntError
    );
    await enableNetwork(firestore);
    expect(await gespeichert(regelProjekt, uid)).toEqual({
      version: 1,
      teams: [313036],
      kinder: [],
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
    const auswahl = await oeffnen(uid);
    await auswahl.folgen(313036);

    await ohneRegeln(regelProjekt, (firestore) =>
      deleteDoc(auswahlDokumentVon(firestore, uid))
    );
    await zuhoeren();

    expect(auswahl.teams()).toEqual([]);
  });
});
