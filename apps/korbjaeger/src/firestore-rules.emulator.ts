import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  type Firestore,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { AUSWAHL_GRENZEN } from './app/auswahl/auswahl-dokument';
import { SPITZNAME_CODEPUNKTE, SPITZNAME_LAENGE } from './app/auswahl/kind';
import {
  alsGeraet,
  APP_REGELN,
  emulatorProjekt,
  vorhanden as vorhandenIn,
} from './testing/firestore-emulator';

/**
 * The app's Firestore rules (`../firestore.rules`) on the emulator: one
 * `auswahl/{uid}` per signed-in Elternteil, only theirs, with only the
 * fields the `Auswahl` stores (ADR 0019) and lists capped as the app caps
 * them (`AUSWAHL_GRENZEN`).
 */
let env: RulesTestEnvironment;

const { teams: TEAMS_HOECHSTENS, kinder: KINDER_HOECHSTENS } = AUSWAHL_GRENZEN;

const ELTERNTEIL = 'elternteil-a';
const ANDERES = 'elternteil-b';

const GUELTIG = {
  version: 1,
  teams: [313036, 201500],
  kinder: [{ personId: 4711, spitzname: 'Mimi' }, { personId: 4712 }],
};

beforeAll(async () => {
  env = await emulatorProjekt('demo-korbjaeger-rules', APP_REGELN);
});

afterAll(() => env.cleanup());

beforeEach(() => env.clearFirestore());

const db = (uid: string): Firestore => alsGeraet(env, uid);

const ohneKonto = (): Firestore =>
  env.unauthenticatedContext().firestore() as unknown as Firestore;

const auswahlVon = (firestore: Firestore, uid: string) =>
  doc(firestore, 'auswahl', uid);

/** Writes past the rules, as an earlier write did. */
const vorhanden = (uid: string, data: object = GUELTIG) =>
  vorhandenIn(env, uid, data);

/** Whether the owner may store `data` as their Auswahl. */
const speichern = (data: object) =>
  setDoc(auswahlVon(db(ELTERNTEIL), ELTERNTEIL), data);

const zahlen = (anzahl: number, ab = 100): number[] =>
  Array.from({ length: anzahl }, (_, i) => ab + i);

const kinderOhneNamen = (anzahl: number) =>
  zahlen(anzahl).map((personId) => ({ personId }));

/** Kinder, each with a Spitzname as long as the rules take. */
const volleKinder = (anzahl: number) =>
  zahlen(anzahl).map((personId) => ({
    personId,
    spitzname: 'x'.repeat(SPITZNAME_CODEPUNKTE),
  }));

/** Documents the rules refuse, whether created or changed into. */
const UNGUELTIG: ReadonlyArray<readonly [string, object]> = [
  ['a field it does not know', { ...GUELTIG, name: 'Mimi Muster' }],
  ['a document without a version', { teams: [] }],
  ['a document of another version', { ...GUELTIG, version: 2 }],
  ['a version that is no number', { ...GUELTIG, version: '1' }],
  [
    'more Teams than the cap',
    { version: 1, teams: zahlen(TEAMS_HOECHSTENS + 1) },
  ],
  ['Teams that are no list', { version: 1, teams: 313036 }],
  ['a Team that is no number', { version: 1, teams: [313036, 'Mimi'] }],
  ['a Team that is no whole number', { version: 1, teams: [1.5] }],
  [
    'an invalid Team at the end',
    { version: 1, teams: [...zahlen(TEAMS_HOECHSTENS - 1), 'x'] },
  ],
  [
    'more Kinder than the cap',
    { version: 1, kinder: kinderOhneNamen(KINDER_HOECHSTENS + 1) },
  ],
  ['Kinder that are no list', { version: 1, kinder: { personId: 1 } }],
  ['a Kind that is no map', { version: 1, kinder: [4711] }],
  [
    'a Kind without a person id',
    { version: 1, kinder: [{ spitzname: 'Mimi' }] },
  ],
  [
    'a person id that is no number',
    { version: 1, kinder: [{ personId: '4711' }] },
  ],
  [
    'a person id that is no whole number',
    { version: 1, kinder: [{ personId: 1.5 }] },
  ],
  ['a person id of 0', { version: 1, kinder: [{ personId: 0 }] }],
  [
    'a Spitzname that is no text',
    { version: 1, kinder: [{ personId: 4711, spitzname: 7 }] },
  ],
  [
    'a Spitzname longer than the app keeps',
    {
      version: 1,
      kinder: [
        { personId: 4711, spitzname: 'x'.repeat(SPITZNAME_CODEPUNKTE + 1) },
      ],
    },
  ],
  [
    'a name of the DBB beside a Kind',
    { version: 1, kinder: [{ personId: 4711, vorname: 'Mimi' }] },
  ],
  [
    'an invalid Kind at the end',
    {
      version: 1,
      kinder: [...kinderOhneNamen(KINDER_HOECHSTENS - 1), { personId: -4 }],
    },
  ],
];

describe('the Auswahl document', () => {
  describe('who may', () => {
    it('lets the owner create, read, change and delete it', async () => {
      const eigene = auswahlVon(db(ELTERNTEIL), ELTERNTEIL);

      await assertSucceeds(setDoc(eigene, GUELTIG));
      await assertSucceeds(getDoc(eigene));
      await assertSucceeds(updateDoc(eigene, { teams: [313036] }));
      await assertSucceeds(deleteDoc(eigene));
    });

    it('lets nobody else read, write or delete it', async () => {
      await vorhanden(ELTERNTEIL);
      const fremde = auswahlVon(db(ANDERES), ELTERNTEIL);

      await assertFails(getDoc(fremde));
      await assertFails(setDoc(fremde, GUELTIG));
      await assertFails(updateDoc(fremde, { teams: [] }));
      await assertFails(deleteDoc(fremde));
    });

    it('lets nobody without an account near it', async () => {
      await vorhanden(ELTERNTEIL);
      const ohne = auswahlVon(ohneKonto(), ELTERNTEIL);

      await assertFails(getDoc(ohne));
      await assertFails(setDoc(ohne, GUELTIG));
      await assertFails(deleteDoc(ohne));
    });

    it('lists nobody the documents of all', async () => {
      await vorhanden(ELTERNTEIL);

      await assertFails(getDocs(collection(db(ELTERNTEIL), 'auswahl')));
    });

    it('keeps every other collection closed', async () => {
      await assertFails(setDoc(doc(db(ELTERNTEIL), 'andere', ELTERNTEIL), {}));
      await assertFails(getDoc(doc(db(ELTERNTEIL), 'andere', ELTERNTEIL)));
    });
  });

  describe('what it holds', () => {
    it('takes a document with only the version, Teams or Kinder', async () => {
      await assertSucceeds(speichern({ version: 1 }));
      await assertSucceeds(speichern({ version: 1, teams: [313036] }));
      await assertSucceeds(speichern({ version: 1, kinder: [] }));
      await assertSucceeds(speichern(GUELTIG));
    });

    // 50 Teams and 20 Kinder are more than one request may check (1000
    // expressions): the app writes one list at a time, as here
    it('takes every Spitzname the app keeps, 30 of the longest emoji too', async () => {
      const familie = '👨🏽‍👩🏽‍👧🏽‍👦🏽';

      await assertSucceeds(
        speichern({
          version: 1,
          kinder: [
            { personId: 4711, spitzname: familie.repeat(SPITZNAME_LAENGE) },
          ],
        })
      );
    });

    it('takes both lists full, one list per write', async () => {
      const eigene = auswahlVon(db(ELTERNTEIL), ELTERNTEIL);

      await assertSucceeds(
        setDoc(eigene, { version: 1, teams: zahlen(TEAMS_HOECHSTENS) })
      );
      await assertSucceeds(
        updateDoc(eigene, { kinder: volleKinder(KINDER_HOECHSTENS) })
      );
      await assertSucceeds(
        updateDoc(eigene, { teams: zahlen(TEAMS_HOECHSTENS - 1) })
      );
      await assertSucceeds(
        updateDoc(eigene, { kinder: volleKinder(KINDER_HOECHSTENS - 1) })
      );
    });

    it.each(UNGUELTIG)('refuses to create %s', async (_, data) => {
      await assertFails(speichern(data));
    });

    it.each(UNGUELTIG)(
      'refuses to change a valid one to %s',
      async (_, data) => {
        await vorhanden(ELTERNTEIL);

        await assertFails(speichern(data));
      }
    );

    it.each([
      ['Teams', { teams: [313036, 'Mimi Muster'] }],
      ['Kinder', { kinder: [{ personId: 4711, vorname: 'Mimi' }] }],
    ])('refuses to change one list into invalid %s', async (_, aenderung) => {
      await vorhanden(ELTERNTEIL);

      await assertFails(
        updateDoc(auswahlVon(db(ELTERNTEIL), ELTERNTEIL), aenderung)
      );
    });
  });
});
