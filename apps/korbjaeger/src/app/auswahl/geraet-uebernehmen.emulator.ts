import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  alsGeraet,
  APP_REGELN,
  emulatorProjekt,
  gespeichert as gespeichertIn,
  vorhanden as vorhandenIn,
} from '../../testing/firestore-emulator';
import {
  contentOf,
  SELECTION_LIMITS,
  readSelectionDocument,
  type SelectionContent,
  SelectionTooNewError,
  takeOverDevice,
} from '@wolsok/feat-korbjaeger-selection';

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
async function gelesen(uid: string): Promise<SelectionContent> {
  const { teams, children, clubColors } = contentOf(
    readSelectionDocument(await gespeichert(uid))
  );
  return { teams, children, clubColors };
}

/** Teams as stored, followed in the order given. */
const teamsRoh = (...ids: readonly number[]) =>
  Object.fromEntries(ids.map((id, i) => [id, i + 1]));

describe('takeOverDevice', () => {
  it("stores the device's choices in an empty account", async () => {
    const uid = konto();

    await takeOverDevice(db(uid), uid, {
      teams: [313036],
      children: [{ personId: 4711, nickname: 'Mimi' }],
      clubColors: [],
    });

    expect(await gelesen(uid)).toEqual({
      teams: [313036],
      children: [{ personId: 4711, nickname: 'Mimi' }],
      clubColors: [],
    });
  });

  it('stores a device that holds only Kinder', async () => {
    const uid = konto();

    await takeOverDevice(db(uid), uid, {
      teams: [],
      children: [{ personId: 4711 }],
      clubColors: [],
    });

    expect(await gelesen(uid)).toEqual({
      teams: [],
      children: [{ personId: 4711 }],
      clubColors: [],
    });
  });

  it("joins overlapping choices, the account's first", async () => {
    const uid = konto();
    await vorhanden(uid, {
      version: 3,
      teams: teamsRoh(313036),
      children: { 4711: { since: 1 } },
    });

    await takeOverDevice(db(uid), uid, {
      teams: [201500, 313036],
      children: [{ personId: 4711, nickname: 'Mimi' }, { personId: 4712 }],
      clubColors: [],
    });

    expect(await gelesen(uid)).toEqual({
      teams: [313036, 201500],
      children: [{ personId: 4711, nickname: 'Mimi' }, { personId: 4712 }],
      clubColors: [],
    });
  });

  it("takes the device's Vereinsfarben for the other Vereine, the account's winning", async () => {
    const uid = konto();
    await vorhanden(uid, {
      version: 3,
      teams: teamsRoh(313036),
      clubColors: { 4343: '#1d4ed8' },
    });

    const uebrig = await takeOverDevice(db(uid), uid, {
      teams: [],
      children: [],
      clubColors: [
        { clubId: 4242, primary: '#c8102e', secondary: '#ffffff' },
        { clubId: 4343, primary: '#007a3d' },
      ],
    });

    expect(uebrig.clubColors).toEqual([]);
    expect(await gelesen(uid)).toEqual({
      teams: [313036],
      children: [],
      clubColors: [
        { clubId: 4242, primary: '#c8102e', secondary: '#ffffff' },
        { clubId: 4343, primary: '#1d4ed8' },
      ],
    });
    expect(await gespeichert(uid)).toMatchObject({
      clubColors: { 4242: '#c8102e,#ffffff', 4343: '#1d4ed8' },
    });
  });

  it('leaves an account already set up with these choices as it is', async () => {
    const uid = konto();
    const eingerichtet = {
      version: 3,
      teams: teamsRoh(313036, 201500),
      children: { 4711: { since: 1, nickname: 'Mimi' } },
    };
    await vorhanden(uid, eingerichtet);

    await takeOverDevice(db(uid), uid, {
      teams: [201500],
      children: [{ personId: 4711 }],
      clubColors: [],
    });

    expect(await gespeichert(uid)).toEqual(eingerichtet);
  });

  it('takes full maps over, one map a write', async () => {
    const uid = konto();
    const kinder = Array.from({ length: 20 }, (_, i) => ({
      personId: i + 1,
      nickname: 'x'.repeat(30),
    }));
    const teams = Array.from({ length: 50 }, (_, i) => i + 1);

    await takeOverDevice(db(uid), uid, {
      teams,
      children: kinder,
      clubColors: [],
    });

    expect(await gelesen(uid)).toEqual({
      teams,
      children: kinder,
      clubColors: [],
    });
  });

  it("leaves a newer version's selection alone", async () => {
    const uid = konto();
    const neuer = { version: 4, teams: {} };
    await vorhanden(uid, neuer);

    await expect(
      takeOverDevice(db(uid), uid, {
        teams: [313036],
        children: [],
        clubColors: [],
      })
    ).rejects.toBeInstanceOf(SelectionTooNewError);
    expect(await gespeichert(uid)).toEqual(neuer);
  });

  it('takes only what fits under the caps and tells the rest', async () => {
    const uid = konto();
    const teams = Array.from(
      { length: SELECTION_LIMITS.teams - 1 },
      (_, i) => i + 1
    );
    await vorhanden(uid, { version: 3, teams: teamsRoh(...teams) });

    const uebrig = await takeOverDevice(db(uid), uid, {
      teams: [9001, 9002, 9003],
      children: [{ personId: 4711 }],
      clubColors: [],
    });

    expect(uebrig).toEqual({
      teams: [9002, 9003],
      children: [],
      clubColors: [],
    });
    expect(await gelesen(uid)).toEqual({
      teams: [...teams, 9001],
      children: [{ personId: 4711 }],
      clubColors: [],
    });
  });

  it('leaves nothing out where all fits', async () => {
    const uid = konto();

    expect(
      await takeOverDevice(db(uid), uid, {
        teams: [313036],
        children: [],
        clubColors: [],
      })
    ).toEqual({ teams: [], children: [], clubColors: [] });
  });
});
