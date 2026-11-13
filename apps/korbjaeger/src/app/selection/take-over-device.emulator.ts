import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  asDevice,
  APP_RULES,
  emulatorProject,
  stored as gespeichertIn,
  seed as vorhandenIn,
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
let nextUid = 0;

beforeAll(async () => {
  env = await emulatorProject('demo-korbjaeger-takeover', APP_RULES);
});

afterAll(() => env.cleanup());

const account = () => `konto-${nextUid++}`;
const db = (uid: string) => asDevice(env, uid);
const existing = (uid: string, data: object) => vorhandenIn(env, uid, data);
const stored = (uid: string) => gespeichertIn(env, uid);

/** What the account's document holds, as the app reads it. */
async function readBack(uid: string): Promise<SelectionContent> {
  const { teams, children, clubColors } = contentOf(
    readSelectionDocument(await stored(uid))
  );
  return { teams, children, clubColors };
}

/** Teams as stored, followed in the order given. */
const rawTeams = (...ids: readonly number[]) =>
  Object.fromEntries(ids.map((id, i) => [id, i + 1]));

describe('takeOverDevice', () => {
  it("stores the device's choices in an empty account", async () => {
    const uid = account();

    await takeOverDevice(db(uid), uid, {
      teams: [313036],
      children: [{ personId: 4711, nickname: 'Mimi' }],
      clubColors: [],
    });

    expect(await readBack(uid)).toEqual({
      teams: [313036],
      children: [{ personId: 4711, nickname: 'Mimi' }],
      clubColors: [],
    });
  });

  it('stores a device that holds only Kinder', async () => {
    const uid = account();

    await takeOverDevice(db(uid), uid, {
      teams: [],
      children: [{ personId: 4711 }],
      clubColors: [],
    });

    expect(await readBack(uid)).toEqual({
      teams: [],
      children: [{ personId: 4711 }],
      clubColors: [],
    });
  });

  it("joins overlapping choices, the account's first", async () => {
    const uid = account();
    await existing(uid, {
      version: 3,
      teams: rawTeams(313036),
      children: { 4711: { since: 1 } },
    });

    await takeOverDevice(db(uid), uid, {
      teams: [201500, 313036],
      children: [{ personId: 4711, nickname: 'Mimi' }, { personId: 4712 }],
      clubColors: [],
    });

    expect(await readBack(uid)).toEqual({
      teams: [313036, 201500],
      children: [{ personId: 4711, nickname: 'Mimi' }, { personId: 4712 }],
      clubColors: [],
    });
  });

  it("takes the device's Vereinsfarben for the other Vereine, the account's winning", async () => {
    const uid = account();
    await existing(uid, {
      version: 3,
      teams: rawTeams(313036),
      clubColors: { 4343: '#1d4ed8' },
    });

    const leftOver = await takeOverDevice(db(uid), uid, {
      teams: [],
      children: [],
      clubColors: [
        { clubId: 4242, primary: '#c8102e', secondary: '#ffffff' },
        { clubId: 4343, primary: '#007a3d' },
      ],
    });

    expect(leftOver.clubColors).toEqual([]);
    expect(await readBack(uid)).toEqual({
      teams: [313036],
      children: [],
      clubColors: [
        { clubId: 4242, primary: '#c8102e', secondary: '#ffffff' },
        { clubId: 4343, primary: '#1d4ed8' },
      ],
    });
    expect(await stored(uid)).toMatchObject({
      clubColors: { 4242: '#c8102e,#ffffff', 4343: '#1d4ed8' },
    });
  });

  it('leaves an account already set up with these choices as it is', async () => {
    const uid = account();
    const prepared = {
      version: 3,
      teams: rawTeams(313036, 201500),
      children: { 4711: { since: 1, nickname: 'Mimi' } },
    };
    await existing(uid, prepared);

    await takeOverDevice(db(uid), uid, {
      teams: [201500],
      children: [{ personId: 4711 }],
      clubColors: [],
    });

    expect(await stored(uid)).toEqual(prepared);
  });

  it('takes full maps over, one map a write', async () => {
    const uid = account();
    const children = Array.from({ length: 20 }, (_, i) => ({
      personId: i + 1,
      nickname: 'x'.repeat(30),
    }));
    const teams = Array.from({ length: 50 }, (_, i) => i + 1);

    await takeOverDevice(db(uid), uid, {
      teams,
      children,
      clubColors: [],
    });

    expect(await readBack(uid)).toEqual({
      teams,
      children,
      clubColors: [],
    });
  });

  it("leaves a newer version's selection alone", async () => {
    const uid = account();
    const newer = { version: 4, teams: {} };
    await existing(uid, newer);

    await expect(
      takeOverDevice(db(uid), uid, {
        teams: [313036],
        children: [],
        clubColors: [],
      })
    ).rejects.toBeInstanceOf(SelectionTooNewError);
    expect(await stored(uid)).toEqual(newer);
  });

  it('takes only what fits under the caps and tells the rest', async () => {
    const uid = account();
    const teams = Array.from(
      { length: SELECTION_LIMITS.teams - 1 },
      (_, i) => i + 1
    );
    await existing(uid, { version: 3, teams: rawTeams(...teams) });

    const leftOver = await takeOverDevice(db(uid), uid, {
      teams: [9001, 9002, 9003],
      children: [{ personId: 4711 }],
      clubColors: [],
    });

    expect(leftOver).toEqual({
      teams: [9002, 9003],
      children: [],
      clubColors: [],
    });
    expect(await readBack(uid)).toEqual({
      teams: [...teams, 9001],
      children: [{ personId: 4711 }],
      clubColors: [],
    });
  });

  it('leaves nothing out where all fits', async () => {
    const uid = account();

    expect(
      await takeOverDevice(db(uid), uid, {
        teams: [313036],
        children: [],
        clubColors: [],
      })
    ).toEqual({ teams: [], children: [], clubColors: [] });
  });
});
