import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  type Firestore,
  getDoc,
  setDoc,
  setLogLevel,
  waitForPendingWrites,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { FIRESTORE_EMULATOR } from '../../testing/firestore-emulator';
import { auswahlDokumentVon, FirestoreAuswahl } from './firestore-auswahl';
import { auswahlVertrag } from './testing/auswahl-vertrag';

/**
 * `FirestoreAuswahl` on the emulator: the shared contract of every
 * `Auswahl` adapter, on rules that let everything through (the contract
 * stores documents the rules would refuse, as a later version or a fault
 * might), and the adapter's own writes against the app's rules.
 */

/** How long the open adapters get to hear of the last write. */
const ZUHOEREN_MS = 300;

let vertragsUmgebung: RulesTestEnvironment;
let regelUmgebung: RulesTestEnvironment;
let naechsteUid = 0;

beforeAll(async () => {
  setLogLevel('silent');
  vertragsUmgebung = await initializeTestEnvironment({
    projectId: 'demo-korbjaeger-vertrag',
    firestore: {
      ...FIRESTORE_EMULATOR,
      rules: `rules_version = '2';
        service cloud.firestore {
          match /{document=**} { allow read, write: if true; }
        }`,
    },
  });
  regelUmgebung = await initializeTestEnvironment({
    projectId: 'demo-korbjaeger-auswahl',
    firestore: {
      ...FIRESTORE_EMULATOR,
      rules: readFileSync(
        new URL('../../../firestore.rules', import.meta.url),
        'utf8'
      ),
    },
  });
});

afterAll(async () => {
  await vertragsUmgebung.cleanup();
  await regelUmgebung.cleanup();
});

/** A device signed in as `uid`: a Firestore instance of its own. */
function geraet(umgebung: RulesTestEnvironment, uid: string): Firestore {
  return umgebung.authenticatedContext(uid).firestore() as unknown as Firestore;
}

/** Does `tun` with the document of `uid`, past the rules. */
function ohneRegeln<T>(
  umgebung: RulesTestEnvironment,
  uid: string,
  tun: (firestore: Firestore) => Promise<T>
): Promise<T> {
  let ergebnis!: T;
  return umgebung
    .withSecurityRulesDisabled(async (context: RulesTestContext) => {
      ergebnis = await tun(context.firestore() as unknown as Firestore);
    })
    .then(() => ergebnis);
}

auswahlVertrag('Firestore', () => {
  // a fresh account per test: its document is the store
  const uid = `vertrag-${naechsteUid++}`;
  const geraete: Firestore[] = [];
  const offen: FirestoreAuswahl[] = [];
  afterEach(() => offen.forEach((auswahl) => auswahl.beenden()));
  return {
    oeffnen: async () => {
      const firestore = geraet(vertragsUmgebung, uid);
      geraete.push(firestore);
      const auswahl = new FirestoreAuswahl(firestore, uid);
      offen.push(auswahl);
      await auswahl.geladen();
      return auswahl;
    },
    schreibeRoh: (dokument) =>
      ohneRegeln(vertragsUmgebung, uid, (firestore) =>
        setDoc(auswahlDokumentVon(firestore, uid), dokument as object)
      ),
    liesRoh: () =>
      ohneRegeln(vertragsUmgebung, uid, async (firestore) => {
        const stand = await getDoc(auswahlDokumentVon(firestore, uid));
        return stand.exists() ? stand.data() : null;
      }),
    bisStabil: async () => {
      await Promise.all(
        geraete.map((firestore) => waitForPendingWrites(firestore))
      );
      await new Promise((weiter) => setTimeout(weiter, ZUHOEREN_MS));
    },
  };
});

describe('FirestoreAuswahl', () => {
  const MIMI = { art: 'benannt', personId: 4711 } as const;

  it("writes what the app's rules take, list by list", async () => {
    const uid = 'regeln-schreiben';
    const auswahl = new FirestoreAuswahl(geraet(regelUmgebung, uid), uid);
    await auswahl.geladen();

    await auswahl.folgen(313036);
    await auswahl.markieren(MIMI, 'Mimi');
    await auswahl.spitznameSetzen(MIMI.personId, 'Mi');
    await auswahl.folgen(201500);
    await auswahl.entfolgen(313036);
    await auswahl.entmarkieren(MIMI.personId);

    expect(
      await ohneRegeln(regelUmgebung, uid, async (firestore) =>
        (await getDoc(auswahlDokumentVon(firestore, uid))).data()
      )
    ).toEqual({ version: 1, teams: [201500], kinder: [] });
    auswahl.beenden();
  });

  it('reads nothing of another account', async () => {
    const auswahl = new FirestoreAuswahl(
      geraet(regelUmgebung, 'regeln-fremd'),
      'regeln-andere'
    );

    await expect(auswahl.geladen()).rejects.toMatchObject({
      code: 'permission-denied',
    });
    auswahl.beenden();
  });

  it('shows the selection gone once the document is deleted', async () => {
    const uid = 'regeln-geloescht';
    const auswahl = new FirestoreAuswahl(geraet(regelUmgebung, uid), uid);
    await auswahl.geladen();
    await auswahl.folgen(313036);

    await ohneRegeln(regelUmgebung, uid, (firestore) =>
      deleteDoc(auswahlDokumentVon(firestore, uid))
    );
    await new Promise((weiter) => setTimeout(weiter, ZUHOEREN_MS));

    expect(auswahl.teams()).toEqual([]);
    auswahl.beenden();
  });
});
