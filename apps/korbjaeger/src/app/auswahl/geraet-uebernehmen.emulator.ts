import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  type Firestore,
  getDoc,
  setDoc,
  setLogLevel,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { FIRESTORE_EMULATOR } from '../../testing/firestore-emulator';
import { AuswahlZuNeuError } from './auswahl-fehler';
import { auswahlDokumentVon } from './firestore-auswahl';
import { geraetUebernehmen } from './geraet-uebernehmen';

/** The merge at sign-in on the emulator, under the app's rules. */
let env: RulesTestEnvironment;
let naechsteUid = 0;

beforeAll(async () => {
  setLogLevel('silent');
  env = await initializeTestEnvironment({
    projectId: 'demo-korbjaeger-uebernahme',
    firestore: {
      ...FIRESTORE_EMULATOR,
      rules: readFileSync(
        new URL('../../../firestore.rules', import.meta.url),
        'utf8'
      ),
    },
  });
});

afterAll(() => env.cleanup());

const konto = () => `konto-${naechsteUid++}`;

const db = (uid: string): Firestore =>
  env.authenticatedContext(uid).firestore() as unknown as Firestore;

function vorhanden(uid: string, dokument: object): Promise<void> {
  return env.withSecurityRulesDisabled((context: RulesTestContext) =>
    setDoc(
      auswahlDokumentVon(context.firestore() as unknown as Firestore, uid),
      dokument
    )
  );
}

async function gespeichert(uid: string): Promise<unknown> {
  let daten: unknown;
  await env.withSecurityRulesDisabled(async (context: RulesTestContext) => {
    daten = (
      await getDoc(
        auswahlDokumentVon(context.firestore() as unknown as Firestore, uid)
      )
    ).data();
  });
  return daten;
}

describe('geraetUebernehmen', () => {
  it("stores the device's choices in an empty account", async () => {
    const uid = konto();

    await geraetUebernehmen(db(uid), uid, {
      teams: [313036],
      kinder: [{ personId: 4711, spitzname: 'Mimi' }],
    });

    expect(await gespeichert(uid)).toEqual({
      version: 1,
      teams: [313036],
      kinder: [{ personId: 4711, spitzname: 'Mimi' }],
    });
  });

  it('stores a device that holds only Kinder', async () => {
    const uid = konto();

    await geraetUebernehmen(db(uid), uid, {
      teams: [],
      kinder: [{ personId: 4711 }],
    });

    expect(await gespeichert(uid)).toEqual({
      version: 1,
      teams: [],
      kinder: [{ personId: 4711 }],
    });
  });

  it("joins overlapping choices, the account's first", async () => {
    const uid = konto();
    await vorhanden(uid, {
      version: 1,
      teams: [313036],
      kinder: [{ personId: 4711 }],
    });

    await geraetUebernehmen(db(uid), uid, {
      teams: [201500, 313036],
      kinder: [{ personId: 4711, spitzname: 'Mimi' }, { personId: 4712 }],
    });

    expect(await gespeichert(uid)).toEqual({
      version: 1,
      teams: [313036, 201500],
      kinder: [{ personId: 4711, spitzname: 'Mimi' }, { personId: 4712 }],
    });
  });

  it('leaves an account already set up with these choices as it is', async () => {
    const uid = konto();
    const eingerichtet = {
      version: 1,
      teams: [313036, 201500],
      kinder: [{ personId: 4711, spitzname: 'Mimi' }],
    };
    await vorhanden(uid, eingerichtet);

    await geraetUebernehmen(db(uid), uid, {
      teams: [201500],
      kinder: [{ personId: 4711 }],
    });

    expect(await gespeichert(uid)).toEqual(eingerichtet);
  });

  it('takes full lists over, one list a write', async () => {
    const uid = konto();
    const kinder = Array.from({ length: 20 }, (_, i) => ({
      personId: i + 1,
      spitzname: 'x'.repeat(30),
    }));
    const teams = Array.from({ length: 50 }, (_, i) => i + 1);

    await geraetUebernehmen(db(uid), uid, { teams, kinder });

    expect(await gespeichert(uid)).toEqual({ version: 1, teams, kinder });
  });

  it("leaves a newer version's selection alone", async () => {
    const uid = konto();
    const neuer = { version: 2, teams: [] };
    await vorhanden(uid, neuer);

    await expect(
      geraetUebernehmen(db(uid), uid, { teams: [313036], kinder: [] })
    ).rejects.toBeInstanceOf(AuswahlZuNeuError);
    expect(await gespeichert(uid)).toEqual(neuer);
  });
});
