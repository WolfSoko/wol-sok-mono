import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  alsGeraet,
  APP_REGELN,
  emulatorProjekt,
  gespeichert as gespeichertIn,
  vorhanden as vorhandenIn,
} from '../../testing/firestore-emulator';
import { AUSWAHL_GRENZEN } from './auswahl-dokument';
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

  it('takes only what fits under the caps and counts the rest', async () => {
    const uid = konto();
    const teams = Array.from(
      { length: AUSWAHL_GRENZEN.teams - 1 },
      (_, i) => i + 1
    );
    await vorhanden(uid, { version: 1, teams, kinder: [] });

    const uebrig = await geraetUebernehmen(db(uid), uid, {
      teams: [9001, 9002, 9003],
      kinder: [{ personId: 4711 }],
    });

    expect(uebrig).toEqual({ teams: 2, kinder: 0 });
    expect(await gespeichert(uid)).toEqual({
      version: 1,
      teams: [...teams, 9001],
      kinder: [{ personId: 4711 }],
    });
  });

  it('counts nothing left out where all fits', async () => {
    const uid = konto();

    expect(
      await geraetUebernehmen(db(uid), uid, { teams: [313036], kinder: [] })
    ).toEqual({ teams: 0, kinder: 0 });
  });
});
