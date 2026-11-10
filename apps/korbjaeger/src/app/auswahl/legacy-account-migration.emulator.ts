import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  alsGeraet,
  APP_REGELN,
  emulatorProjekt,
  gespeichert as gespeichertIn,
  ohneRegeln,
  vorhanden as vorhandenIn,
} from '../../testing/firestore-emulator';
import {
  inhaltAus,
  auswahlDokumentLesen,
  type AuswahlInhalt,
  legacyAccountMigration,
} from '@wolsok/feat-korbjaeger-auswahl';
import { LEGACY_CHOICES_COLLECTION } from '@wolsok/feat-shared-korbjaeger-account';

/**
 * The move of an account's selection of version 2 (`auswahl/{uid}`, German
 * fields) into `selections/{uid}` (#2966), on the emulator under the app's
 * rules.
 */
let env: RulesTestEnvironment;
let naechsteUid = 0;

beforeAll(async () => {
  env = await emulatorProjekt('demo-korbjaeger-migration', APP_REGELN);
});

afterAll(() => env.cleanup());

const konto = () => `migration-${naechsteUid++}`;
const db = (uid: string) => alsGeraet(env, uid);

/** A selection as the app of version 2 stored it. */
const VERSION_2 = {
  version: 2,
  teams: { 313036: 10, 201500: 20 },
  kinder: { 4712: { seit: 30 }, 4711: { seit: 40, spitzname: 'Mimi' } },
  vereinsfarben: { 4343: '#1d4ed8,#ffffff' },
};

/** What it holds, as the app shows it. */
const WIE_GEZEIGT: AuswahlInhalt = {
  teams: [313036, 201500],
  kinder: [{ personId: 4712 }, { personId: 4711, spitzname: 'Mimi' }],
  vereinsfarben: [{ vereinId: 4343, primaer: '#1d4ed8', zweite: '#ffffff' }],
};

function legacyVorhanden(uid: string, daten: object = VERSION_2) {
  return ohneRegeln(env, (firestore) =>
    setDoc(doc(firestore, LEGACY_CHOICES_COLLECTION, uid), daten)
  );
}

function legacyGespeichert(uid: string): Promise<boolean> {
  return ohneRegeln(env, async (firestore) =>
    (await getDoc(doc(firestore, LEGACY_CHOICES_COLLECTION, uid))).exists()
  );
}

/** What the account's document holds, as the app reads it. */
async function gelesen(uid: string): Promise<AuswahlInhalt> {
  const { teams, kinder, vereinsfarben } = inhaltAus(
    auswahlDokumentLesen(await gespeichertIn(env, uid))
  );
  return { teams, kinder, vereinsfarben };
}

describe('legacyAccountMigration', () => {
  it('moves the selection of version 2 into the new document, the same choices in the same order', async () => {
    const uid = konto();
    await legacyVorhanden(uid);

    await legacyAccountMigration(db(uid), uid);

    expect(await gelesen(uid)).toEqual(WIE_GEZEIGT);
    expect(await gespeichertIn(env, uid)).toMatchObject({
      version: 3,
      children: { 4711: { nickname: 'Mimi' } },
      clubColors: { 4343: '#1d4ed8,#ffffff' },
    });
    expect(await legacyGespeichert(uid)).toBe(false);
  });

  it('changes nothing on a second run, as a run cut short repeats', async () => {
    const uid = konto();
    await legacyVorhanden(uid);
    await legacyAccountMigration(db(uid), uid);
    const einmal = await gespeichertIn(env, uid);

    // the deletion did not happen: the next opening joins the same again
    await legacyVorhanden(uid);
    await legacyAccountMigration(db(uid), uid);

    expect(await gespeichertIn(env, uid)).toEqual(einmal);
    expect(await legacyGespeichert(uid)).toBe(false);
  });

  it('keeps what the new document holds first', async () => {
    const uid = konto();
    await vorhandenIn(env, uid, { version: 3, teams: { 201765: 1 } });
    await legacyVorhanden(uid);

    await legacyAccountMigration(db(uid), uid);

    expect((await gelesen(uid)).teams).toEqual([201765, 313036, 201500]);
  });

  it('does nothing without a legacy document', async () => {
    const uid = konto();

    await legacyAccountMigration(db(uid), uid);

    expect(await gespeichertIn(env, uid)).toBeNull();
  });

  it('drops a legacy document it cannot read, writing nothing', async () => {
    const uid = konto();
    await legacyVorhanden(uid, { version: 2, teams: 'kaputt' });

    await legacyAccountMigration(db(uid), uid);

    expect(await gespeichertIn(env, uid)).toBeNull();
    expect(await legacyGespeichert(uid)).toBe(false);
  });
});
