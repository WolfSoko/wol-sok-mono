import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  deleteField,
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
 * fields the `Auswahl` stores (ADR 0019) and maps capped as the app caps
 * them (`AUSWAHL_GRENZEN`).
 */
let env: RulesTestEnvironment;

const {
  teams: TEAMS_HOECHSTENS,
  kinder: KINDER_HOECHSTENS,
  vereinsfarben: VEREINE_HOECHSTENS,
} = AUSWAHL_GRENZEN;

const ELTERNTEIL = 'elternteil-a';
const ANDERES = 'elternteil-b';

const GUELTIG = {
  version: 2,
  teams: { 313036: 1, 201500: 2 },
  kinder: { 4711: { seit: 1, spitzname: 'Mimi' }, 4712: { seit: 2 } },
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

/** `anzahl` Teams, keyed by id, each followed since its place. */
const teamsVon = (anzahl: number): Record<string, number> =>
  Object.fromEntries(zahlen(anzahl).map((id, seit) => [id, seit]));

const kinderOhneNamen = (anzahl: number) =>
  Object.fromEntries(zahlen(anzahl).map((id, seit) => [id, { seit }]));

/** Kinder, each with a Spitzname as long as the rules take. */
const volleKinder = (anzahl: number) =>
  Object.fromEntries(
    zahlen(anzahl).map((id, seit) => [
      id,
      { seit, spitzname: 'x'.repeat(SPITZNAME_CODEPUNKTE) },
    ])
  );

/** Vereinsfarben, each Verein with both colours. */
const volleVereinsfarben = (anzahl: number) =>
  Object.fromEntries(zahlen(anzahl).map((id) => [id, '#c8102e,#1d4ed8']));

/** Documents the rules refuse, whether created or changed into. */
const UNGUELTIG: ReadonlyArray<readonly [string, object]> = [
  ['a field it does not know', { ...GUELTIG, name: 'Mimi Muster' }],
  ['a document without a version', { teams: {} }],
  ['a document of another version', { ...GUELTIG, version: 3 }],
  ['a version that is no number', { ...GUELTIG, version: '2' }],
  [
    'more Teams than the cap',
    { version: 2, teams: teamsVon(TEAMS_HOECHSTENS + 1) },
  ],
  ['Teams that are no map', { version: 2, teams: 313036 }],
  ['Teams as a list', { version: 2, teams: [313036] }],
  ['a Team whose id is no number', { version: 2, teams: { Mimi: 1 } }],
  ['a Team whose id is 0', { version: 2, teams: { 0: 1 } }],
  [
    'a key that holds two Team ids',
    { version: 2, teams: { '313036,201500': 1 } },
  ],
  [
    'a Team id beyond the safe integers',
    { version: 2, teams: { '9007199254740993': 1 } },
  ],
  [
    'a Kind key that holds two ids',
    { version: 2, kinder: { '1,2': { seit: 1 } } },
  ],
  ['a Team since no whole number', { version: 2, teams: { 313036: 1.5 } }],
  ['a Team since a text', { version: 2, teams: { 313036: 'heute' } }],
  [
    'an invalid Team at the end',
    { version: 2, teams: { ...teamsVon(TEAMS_HOECHSTENS - 1), 999999: 'x' } },
  ],
  [
    'more Kinder than the cap',
    { version: 2, kinder: kinderOhneNamen(KINDER_HOECHSTENS + 1) },
  ],
  ['Kinder that are no map', { version: 2, kinder: 4711 }],
  ['Kinder as a list', { version: 2, kinder: [{ personId: 4711 }] }],
  ['a Kind that is no map', { version: 2, kinder: { 4711: 1 } }],
  [
    'a Kind since when not',
    { version: 2, kinder: { 4711: { spitzname: 'Mimi' } } },
  ],
  [
    'a Kind whose id is no number',
    { version: 2, kinder: { Mimi: { seit: 1 } } },
  ],
  [
    'a Kind whose id is negative',
    { version: 2, kinder: { '-4': { seit: 1 } } },
  ],
  [
    'a Kind since no whole number',
    { version: 2, kinder: { 4711: { seit: 1.5 } } },
  ],
  [
    'a Spitzname that is no text',
    { version: 2, kinder: { 4711: { seit: 1, spitzname: 7 } } },
  ],
  [
    'a Spitzname longer than the app keeps',
    {
      version: 2,
      kinder: {
        4711: { seit: 1, spitzname: 'x'.repeat(SPITZNAME_CODEPUNKTE + 1) },
      },
    },
  ],
  [
    'a name of the DBB beside a Kind',
    { version: 2, kinder: { 4711: { seit: 1, vorname: 'Mimi' } } },
  ],
  [
    'more Vereinsfarben than the cap',
    { version: 2, vereinsfarben: volleVereinsfarben(VEREINE_HOECHSTENS + 1) },
  ],
  ['Vereinsfarben that are no map', { version: 2, vereinsfarben: '#c8102e' }],
  [
    'a colour in upper case',
    { version: 2, vereinsfarben: { 4242: '#C8102E' } },
  ],
  ['a colour by its name', { version: 2, vereinsfarben: { 4242: 'red' } }],
  ['a colour of three digits', { version: 2, vereinsfarben: { 4242: '#c81' } }],
  [
    'a second colour without a first',
    { version: 2, vereinsfarben: { 4242: ',#1d4ed8' } },
  ],
  [
    'a second colour that is no colour',
    {
      version: 2,
      vereinsfarben: { 4242: '#c8102e,7' },
    },
  ],
  [
    "a name beside a Verein's colours",
    {
      version: 2,
      vereinsfarben: { 4242: '#c8102e,TSV Muster' },
    },
  ],
  ['an empty colour', { version: 2, vereinsfarben: { 4242: '' } }],
  [
    'three colours',
    { version: 2, vereinsfarben: { 4242: '#c8102e,#1d4ed8,#007a3d' } },
  ],
  [
    "two Vereine's colours in one value",
    { version: 2, vereinsfarben: { 4242: '#c8102e;#1d4ed8' } },
  ],
  [
    'colours as a map',
    { version: 2, vereinsfarben: { 4242: { primaer: '#c8102e' } } },
  ],
  [
    'a Verein whose id is no number',
    { version: 2, vereinsfarben: { TSV: '#c8102e' } },
  ],
  [
    'invalid colours at the end',
    {
      version: 2,
      vereinsfarben: {
        ...volleVereinsfarben(VEREINE_HOECHSTENS - 1),
        999999: 'x',
      },
    },
  ],
  [
    'an invalid Kind at the end',
    {
      version: 2,
      kinder: {
        ...kinderOhneNamen(KINDER_HOECHSTENS - 1),
        999999: { seit: 'x' },
      },
    },
  ],
];

describe('the Auswahl document', () => {
  describe('who may', () => {
    it('lets the owner create, read, change and delete it', async () => {
      const eigene = auswahlVon(db(ELTERNTEIL), ELTERNTEIL);

      await assertSucceeds(setDoc(eigene, GUELTIG));
      await assertSucceeds(getDoc(eigene));
      await assertSucceeds(updateDoc(eigene, { teams: { 313036: 3 } }));
      await assertSucceeds(deleteDoc(eigene));
    });

    it('lets nobody else read, write or delete it', async () => {
      await vorhanden(ELTERNTEIL);
      const fremde = auswahlVon(db(ANDERES), ELTERNTEIL);

      await assertFails(getDoc(fremde));
      await assertFails(setDoc(fremde, GUELTIG));
      await assertFails(updateDoc(fremde, { teams: {} }));
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
      await assertSucceeds(speichern({ version: 2 }));
      await assertSucceeds(speichern({ version: 2, teams: { 313036: 1 } }));
      await assertSucceeds(speichern({ version: 2, kinder: {} }));
      await assertSucceeds(speichern(GUELTIG));
    });

    // 50 Teams and 20 Kinder are more than one request may check (1000
    // expressions): the app writes one list at a time, as here
    it('takes every Spitzname the app keeps, 30 of the longest emoji too', async () => {
      const familie = '👨🏽‍👩🏽‍👧🏽‍👦🏽';

      await assertSucceeds(
        speichern({
          version: 2,
          kinder: {
            4711: { seit: 1, spitzname: familie.repeat(SPITZNAME_LAENGE) },
          },
        })
      );
    });

    it('takes both maps full, one map per write', async () => {
      const eigene = auswahlVon(db(ELTERNTEIL), ELTERNTEIL);

      await assertSucceeds(
        setDoc(eigene, { version: 2, teams: teamsVon(TEAMS_HOECHSTENS) })
      );
      await assertSucceeds(
        updateDoc(eigene, { kinder: volleKinder(KINDER_HOECHSTENS) })
      );
      await assertSucceeds(
        updateDoc(eigene, { teams: teamsVon(TEAMS_HOECHSTENS - 1) })
      );
      await assertSucceeds(
        updateDoc(eigene, { kinder: volleKinder(KINDER_HOECHSTENS - 1) })
      );
      await assertSucceeds(
        updateDoc(eigene, {
          vereinsfarben: volleVereinsfarben(VEREINE_HOECHSTENS),
        })
      );
    });

    it('takes a full map of Vereinsfarben in the write that creates it', async () => {
      await assertSucceeds(
        speichern({
          version: 2,
          vereinsfarben: volleVereinsfarben(VEREINE_HOECHSTENS),
        })
      );
    });

    it("takes a Verein's colours set and changed entry by entry, as the app writes them", async () => {
      await vorhanden(ELTERNTEIL, {
        ...GUELTIG,
        vereinsfarben: volleVereinsfarben(VEREINE_HOECHSTENS - 1),
      });
      const eigene = auswahlVon(db(ELTERNTEIL), ELTERNTEIL);

      await assertSucceeds(
        setDoc(
          eigene,
          {
            version: 2,
            vereinsfarben: { 4242: '#c8102e,#1d4ed8' },
          },
          { merge: true }
        )
      );
      await assertSucceeds(
        setDoc(
          eigene,
          {
            version: 2,
            vereinsfarben: {
              4242: '#007a3d',
            },
          },
          { merge: true }
        )
      );
      await assertSucceeds(
        updateDoc(eigene, { 'vereinsfarben.4242': deleteField() })
      );
    });

    it('takes a change of single entries, as the app writes them', async () => {
      await vorhanden(ELTERNTEIL, {
        version: 2,
        teams: teamsVon(TEAMS_HOECHSTENS - 1),
        kinder: volleKinder(KINDER_HOECHSTENS - 1),
      });
      const eigene = auswahlVon(db(ELTERNTEIL), ELTERNTEIL);

      await assertSucceeds(
        setDoc(eigene, { version: 2, teams: { 313036: 9 } }, { merge: true })
      );
      await assertSucceeds(
        updateDoc(eigene, { 'kinder.4711': { seit: 9, spitzname: 'Mimi' } })
      );
      await assertSucceeds(
        updateDoc(eigene, { 'kinder.4711.spitzname': 'Mi' })
      );
      await assertSucceeds(
        updateDoc(eigene, { 'teams.313036': deleteField() })
      );
    });

    it('refuses an entry merged past the cap, rather than cutting it', async () => {
      await vorhanden(ELTERNTEIL, {
        version: 2,
        teams: teamsVon(TEAMS_HOECHSTENS),
      });

      await assertFails(
        setDoc(
          auswahlVon(db(ELTERNTEIL), ELTERNTEIL),
          { version: 2, teams: { 313036: 9 } },
          { merge: true }
        )
      );
    });

    it('takes ids up to 15 digits, every DBB id', async () => {
      await assertSucceeds(
        speichern({ version: 2, teams: { '999999999999999': 1 } })
      );
    });

    it('lets a map over its cap, as stored earlier, shrink one entry at a time', async () => {
      await vorhanden(ELTERNTEIL, {
        version: 2,
        teams: teamsVon(TEAMS_HOECHSTENS + 2),
        kinder: kinderOhneNamen(KINDER_HOECHSTENS + 1),
      });
      const eigene = auswahlVon(db(ELTERNTEIL), ELTERNTEIL);

      await assertSucceeds(updateDoc(eigene, { 'teams.100': deleteField() }));
      await assertSucceeds(updateDoc(eigene, { 'kinder.100': deleteField() }));
      await assertFails(updateDoc(eigene, { 'teams.999999': 1 }));
    });

    it('refuses a Spitzname for a Kind no longer marked', async () => {
      await vorhanden(ELTERNTEIL, { version: 2, kinder: {} });

      await assertFails(
        setDoc(
          auswahlVon(db(ELTERNTEIL), ELTERNTEIL),
          { version: 2, kinder: { 4711: { spitzname: 'Mimi' } } },
          { merge: true }
        )
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
      ['Teams', { 'teams.313036': 'Mimi Muster' }],
      ['Kinder', { 'kinder.4711.vorname': 'Mimi' }],
      ['Vereinsfarben', { 'vereinsfarben.4242': 'rot' }],
    ])('refuses to change one map into invalid %s', async (_, aenderung) => {
      await vorhanden(ELTERNTEIL);

      await assertFails(
        updateDoc(auswahlVon(db(ELTERNTEIL), ELTERNTEIL), aenderung)
      );
    });
  });
});
