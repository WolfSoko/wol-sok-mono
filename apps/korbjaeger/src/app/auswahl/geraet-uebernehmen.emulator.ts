import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  alsGeraet,
  APP_REGELN,
  emulatorProjekt,
  gespeichert as gespeichertIn,
  vorhanden as vorhandenIn,
} from '../../testing/firestore-emulator';
import { inhaltAus } from './auswahl-aenderungen';
import {
  AUSWAHL_GRENZEN,
  auswahlDokumentLesen,
  type AuswahlInhalt,
} from './auswahl-dokument';
import { AuswahlZuNeuError } from './auswahl-fehler';
import { geraetUebernehmen } from './geraet-uebernehmen';

/** The merge at sign-in on the emulator, under the app's rules. */
let env: RulesTestEnvironment;
let naechsteUid = 0;

beforeAll(async () => {
  env = await emulatorProjekt('demo-korbjaeger-uebernahme', APP_REGELN);
});

afterAll(() => env.cleanup());

const konto = () => `konto-${naechsteUid++}`;
const db = (uid: string) => alsGeraet(env, uid);
const vorhanden = (uid: string, daten: object) => vorhandenIn(env, uid, daten);
const gespeichert = (uid: string) => gespeichertIn(env, uid);

/** What the account's document holds, as the app reads it. */
async function gelesen(uid: string): Promise<AuswahlInhalt> {
  const { teams, kinder, vereinsfarben } = inhaltAus(
    auswahlDokumentLesen(await gespeichert(uid))
  );
  return { teams, kinder, vereinsfarben };
}

/** Teams as stored, followed in the order given. */
const teamsRoh = (...ids: readonly number[]) =>
  Object.fromEntries(ids.map((id, i) => [id, i + 1]));

describe('geraetUebernehmen', () => {
  it("stores the device's choices in an empty account", async () => {
    const uid = konto();

    await geraetUebernehmen(db(uid), uid, {
      teams: [313036],
      kinder: [{ personId: 4711, spitzname: 'Mimi' }],
      vereinsfarben: [],
    });

    expect(await gelesen(uid)).toEqual({
      teams: [313036],
      kinder: [{ personId: 4711, spitzname: 'Mimi' }],
      vereinsfarben: [],
    });
  });

  it('stores a device that holds only Kinder', async () => {
    const uid = konto();

    await geraetUebernehmen(db(uid), uid, {
      teams: [],
      kinder: [{ personId: 4711 }],
      vereinsfarben: [],
    });

    expect(await gelesen(uid)).toEqual({
      teams: [],
      kinder: [{ personId: 4711 }],
      vereinsfarben: [],
    });
  });

  it("joins overlapping choices, the account's first", async () => {
    const uid = konto();
    await vorhanden(uid, {
      version: 2,
      teams: teamsRoh(313036),
      kinder: { 4711: { seit: 1 } },
    });

    await geraetUebernehmen(db(uid), uid, {
      teams: [201500, 313036],
      kinder: [{ personId: 4711, spitzname: 'Mimi' }, { personId: 4712 }],
      vereinsfarben: [],
    });

    expect(await gelesen(uid)).toEqual({
      teams: [313036, 201500],
      kinder: [{ personId: 4711, spitzname: 'Mimi' }, { personId: 4712 }],
      vereinsfarben: [],
    });
  });

  it("takes the device's Vereinsfarben for the other Vereine, the account's winning", async () => {
    const uid = konto();
    await vorhanden(uid, {
      version: 2,
      teams: teamsRoh(313036),
      vereinsfarben: { 4343: '#1d4ed8' },
    });

    const uebrig = await geraetUebernehmen(db(uid), uid, {
      teams: [],
      kinder: [],
      vereinsfarben: [
        { vereinId: 4242, primaer: '#c8102e', zweite: '#ffffff' },
        { vereinId: 4343, primaer: '#007a3d' },
      ],
    });

    expect(uebrig.vereinsfarben).toEqual([]);
    expect(await gelesen(uid)).toEqual({
      teams: [313036],
      kinder: [],
      vereinsfarben: [
        { vereinId: 4242, primaer: '#c8102e', zweite: '#ffffff' },
        { vereinId: 4343, primaer: '#1d4ed8' },
      ],
    });
    expect(await gespeichert(uid)).toMatchObject({
      vereinsfarben: { 4242: '#c8102e,#ffffff', 4343: '#1d4ed8' },
    });
  });

  it('leaves an account already set up with these choices as it is', async () => {
    const uid = konto();
    const eingerichtet = {
      version: 2,
      teams: teamsRoh(313036, 201500),
      kinder: { 4711: { seit: 1, spitzname: 'Mimi' } },
    };
    await vorhanden(uid, eingerichtet);

    await geraetUebernehmen(db(uid), uid, {
      teams: [201500],
      kinder: [{ personId: 4711 }],
      vereinsfarben: [],
    });

    expect(await gespeichert(uid)).toEqual(eingerichtet);
  });

  it('takes full maps over, one map a write', async () => {
    const uid = konto();
    const kinder = Array.from({ length: 20 }, (_, i) => ({
      personId: i + 1,
      spitzname: 'x'.repeat(30),
    }));
    const teams = Array.from({ length: 50 }, (_, i) => i + 1);

    await geraetUebernehmen(db(uid), uid, { teams, kinder, vereinsfarben: [] });

    expect(await gelesen(uid)).toEqual({ teams, kinder, vereinsfarben: [] });
  });

  it("leaves a newer version's selection alone", async () => {
    const uid = konto();
    const neuer = { version: 3, teams: {} };
    await vorhanden(uid, neuer);

    await expect(
      geraetUebernehmen(db(uid), uid, {
        teams: [313036],
        kinder: [],
        vereinsfarben: [],
      })
    ).rejects.toBeInstanceOf(AuswahlZuNeuError);
    expect(await gespeichert(uid)).toEqual(neuer);
  });

  it('takes only what fits under the caps and tells the rest', async () => {
    const uid = konto();
    const teams = Array.from(
      { length: AUSWAHL_GRENZEN.teams - 1 },
      (_, i) => i + 1
    );
    await vorhanden(uid, { version: 2, teams: teamsRoh(...teams) });

    const uebrig = await geraetUebernehmen(db(uid), uid, {
      teams: [9001, 9002, 9003],
      kinder: [{ personId: 4711 }],
      vereinsfarben: [],
    });

    expect(uebrig).toEqual({
      teams: [9002, 9003],
      kinder: [],
      vereinsfarben: [],
    });
    expect(await gelesen(uid)).toEqual({
      teams: [...teams, 9001],
      kinder: [{ personId: 4711 }],
      vereinsfarben: [],
    });
  });

  it('leaves nothing out where all fits', async () => {
    const uid = konto();

    expect(
      await geraetUebernehmen(db(uid), uid, {
        teams: [313036],
        kinder: [],
        vereinsfarben: [],
      })
    ).toEqual({ teams: [], kinder: [], vereinsfarben: [] });
  });
});
