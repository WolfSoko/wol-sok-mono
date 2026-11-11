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
import {
  SELECTION_LIMITS,
  NICKNAME_CODE_POINTS,
  NICKNAME_LENGTH,
} from '@wolsok/feat-korbjaeger-selection';
import {
  DELETED_ACCOUNTS_COLLECTION,
  LEGACY_DELETED_ACCOUNTS_COLLECTION,
  LEGACY_CHOICES_COLLECTION,
  CHOICES_COLLECTION,
  CLUB_INDEX_COLLECTION,
} from '@wolsok/feat-shared-korbjaeger-account';
import {
  alsGeraet,
  APP_REGELN,
  emulatorProjekt,
  ohneRegeln,
  vorhanden as vorhandenIn,
} from './testing/firestore-emulator';

/**
 * The app's Firestore rules (`../firestore.rules`) on the emulator: one
 * `selections/{uid}` per signed-in Elternteil, only theirs, with only the
 * fields the `Auswahl` stores (ADR 0019) and maps capped as the app caps
 * them (`AUSWAHL_GRENZEN`).
 */
let env: RulesTestEnvironment;

const {
  teams: TEAMS_HOECHSTENS,
  children: KINDER_HOECHSTENS,
  clubColors: VEREINE_HOECHSTENS,
} = SELECTION_LIMITS;

const ELTERNTEIL = 'elternteil-a';
const ANDERES = 'elternteil-b';

const GUELTIG = {
  version: 3,
  teams: { 313036: 1, 201500: 2 },
  children: { 4711: { since: 1, nickname: 'Mimi' }, 4712: { since: 2 } },
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
  doc(firestore, CHOICES_COLLECTION, uid);

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
  Object.fromEntries(zahlen(anzahl).map((id, seit) => [id, { since: seit }]));

/** Kinder, each with a Spitzname as long as the rules take. */
const volleKinder = (anzahl: number) =>
  Object.fromEntries(
    zahlen(anzahl).map((id, seit) => [
      id,
      { since: seit, nickname: 'x'.repeat(NICKNAME_CODE_POINTS) },
    ])
  );

/** Vereinsfarben, each Verein with both colours. */
const volleVereinsfarben = (anzahl: number) =>
  Object.fromEntries(zahlen(anzahl).map((id) => [id, '#c8102e,#1d4ed8']));

/** Documents the rules refuse, whether created or changed into. */
const UNGUELTIG: ReadonlyArray<readonly [string, object]> = [
  ['a field it does not know', { ...GUELTIG, name: 'Mimi Muster' }],
  ['a document without a version', { teams: {} }],
  ['a document of version 2', { ...GUELTIG, version: 2 }],
  [
    'the German fields of version 2',
    { version: 3, kinder: { 4711: { seit: 1 } }, vereinsfarben: {} },
  ],
  [
    'a Kind marked by its German field',
    { version: 3, children: { 4711: { seit: 1 } } },
  ],
  [
    'a Spitzname by its German field',
    { version: 3, children: { 4711: { since: 1, spitzname: 'Mimi' } } },
  ],
  ['a version that is no number', { ...GUELTIG, version: '3' }],
  [
    'more Teams than the cap',
    { version: 3, teams: teamsVon(TEAMS_HOECHSTENS + 1) },
  ],
  ['Teams that are no map', { version: 3, teams: 313036 }],
  ['Teams as a list', { version: 3, teams: [313036] }],
  ['a Team whose id is no number', { version: 3, teams: { Mimi: 1 } }],
  ['a Team whose id is 0', { version: 3, teams: { 0: 1 } }],
  [
    'a key that holds two Team ids',
    { version: 3, teams: { '313036,201500': 1 } },
  ],
  [
    'a Team id beyond the safe integers',
    { version: 3, teams: { '9007199254740993': 1 } },
  ],
  [
    'a Kind key that holds two ids',
    { version: 3, children: { '1,2': { since: 1 } } },
  ],
  ['a Team since no whole number', { version: 3, teams: { 313036: 1.5 } }],
  ['a Team since a text', { version: 3, teams: { 313036: 'heute' } }],
  [
    'an invalid Team at the end',
    { version: 3, teams: { ...teamsVon(TEAMS_HOECHSTENS - 1), 999999: 'x' } },
  ],
  [
    'more Kinder than the cap',
    { version: 3, children: kinderOhneNamen(KINDER_HOECHSTENS + 1) },
  ],
  ['Kinder that are no map', { version: 3, children: 4711 }],
  ['Kinder as a list', { version: 3, children: [{ personId: 4711 }] }],
  ['a Kind that is no map', { version: 3, children: { 4711: 1 } }],
  [
    'a Kind since when not',
    { version: 3, children: { 4711: { nickname: 'Mimi' } } },
  ],
  [
    'a Kind whose id is no number',
    { version: 3, children: { Mimi: { since: 1 } } },
  ],
  [
    'a Kind whose id is negative',
    { version: 3, children: { '-4': { since: 1 } } },
  ],
  [
    'a Kind since no whole number',
    { version: 3, children: { 4711: { since: 1.5 } } },
  ],
  [
    'a Spitzname that is no text',
    { version: 3, children: { 4711: { since: 1, nickname: 7 } } },
  ],
  [
    'a Spitzname longer than the app keeps',
    {
      version: 3,
      children: {
        4711: { since: 1, nickname: 'x'.repeat(NICKNAME_CODE_POINTS + 1) },
      },
    },
  ],
  [
    'a name of the DBB beside a Kind',
    { version: 3, children: { 4711: { since: 1, vorname: 'Mimi' } } },
  ],
  [
    'more Vereinsfarben than the cap',
    { version: 3, clubColors: volleVereinsfarben(VEREINE_HOECHSTENS + 1) },
  ],
  ['Vereinsfarben that are no map', { version: 3, clubColors: '#c8102e' }],
  ['a colour in upper case', { version: 3, clubColors: { 4242: '#C8102E' } }],
  ['a colour by its name', { version: 3, clubColors: { 4242: 'red' } }],
  ['a colour of three digits', { version: 3, clubColors: { 4242: '#c81' } }],
  [
    'a second colour without a first',
    { version: 3, clubColors: { 4242: ',#1d4ed8' } },
  ],
  [
    'a second colour that is no colour',
    {
      version: 3,
      clubColors: { 4242: '#c8102e,7' },
    },
  ],
  [
    "a name beside a Verein's colours",
    {
      version: 3,
      clubColors: { 4242: '#c8102e,TSV Muster' },
    },
  ],
  ['an empty colour', { version: 3, clubColors: { 4242: '' } }],
  [
    'three colours',
    { version: 3, clubColors: { 4242: '#c8102e,#1d4ed8,#007a3d' } },
  ],
  [
    "two Vereine's colours in one value",
    { version: 3, clubColors: { 4242: '#c8102e;#1d4ed8' } },
  ],
  [
    'colours as a map',
    { version: 3, clubColors: { 4242: { primaer: '#c8102e' } } },
  ],
  [
    'a Verein whose id is no number',
    { version: 3, clubColors: { TSV: '#c8102e' } },
  ],
  [
    'invalid colours at the end',
    {
      version: 3,
      clubColors: {
        ...volleVereinsfarben(VEREINE_HOECHSTENS - 1),
        999999: 'x',
      },
    },
  ],
  [
    'an invalid Kind at the end',
    {
      version: 3,
      children: {
        ...kinderOhneNamen(KINDER_HOECHSTENS - 1),
        999999: { since: 'x' },
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

      await assertFails(
        getDocs(collection(db(ELTERNTEIL), CHOICES_COLLECTION))
      );
    });

    it('keeps the club index closed: only the functions write and the server reads it', async () => {
      await ohneRegeln(env, (admin) =>
        setDoc(doc(admin, CLUB_INDEX_COLLECTION, '7'), { version: 1 })
      );

      for (const client of [db(ELTERNTEIL), ohneKonto()]) {
        await assertFails(getDoc(doc(client, CLUB_INDEX_COLLECTION, '7')));
        await assertFails(getDocs(collection(client, CLUB_INDEX_COLLECTION)));
        await assertFails(setDoc(doc(client, CLUB_INDEX_COLLECTION, '8'), {}));
      }
    });

    it('keeps every other collection closed', async () => {
      await assertFails(setDoc(doc(db(ELTERNTEIL), 'andere', ELTERNTEIL), {}));
      await assertFails(getDoc(doc(db(ELTERNTEIL), 'andere', ELTERNTEIL)));
    });
  });

  // the Auth deletion's trigger (korbjaeger-functions, `kontoGeloescht`)
  // writes the tombstone first: a second device's token stays valid for up
  // to an hour, so the rules refuse it from then on
  // tombstones written before #2966 live a day in the legacy collection
  describe.each([
    DELETED_ACCOUNTS_COLLECTION,
    LEGACY_DELETED_ACCOUNTS_COLLECTION,
  ])('once the account is deleted (tombstone in %s)', (graeber) => {
    const grabstein = (uid: string) =>
      ohneRegeln(env, (firestore) =>
        setDoc(doc(firestore, graeber, uid), {
          expireAt: new Date(),
        })
      );

    it('refuses the owner every request on the Auswahl', async () => {
      await vorhanden(ELTERNTEIL);
      await grabstein(ELTERNTEIL);
      const eigene = auswahlVon(db(ELTERNTEIL), ELTERNTEIL);

      await assertFails(getDoc(eigene));
      await assertFails(setDoc(eigene, GUELTIG));
      await assertFails(updateDoc(eigene, { teams: { 313036: 3 } }));
      await assertFails(deleteDoc(eigene));
    });

    it('refuses the owner creating it anew', async () => {
      await grabstein(ELTERNTEIL);

      await assertFails(speichern(GUELTIG));
    });

    it('leaves other accounts alone', async () => {
      await grabstein(ANDERES);

      await assertSucceeds(speichern(GUELTIG));
    });

    it('lets no client read or write the tombstone', async () => {
      await grabstein(ELTERNTEIL);
      const eigener = doc(db(ELTERNTEIL), graeber, ELTERNTEIL);

      await assertFails(getDoc(eigener));
      await assertFails(deleteDoc(eigener));
      await assertFails(setDoc(doc(db(ANDERES), graeber, ANDERES), {}));
    });
  });

  describe('what it holds', () => {
    it('takes a document with only the version, Teams or Kinder', async () => {
      await assertSucceeds(speichern({ version: 3 }));
      await assertSucceeds(speichern({ version: 3, teams: { 313036: 1 } }));
      await assertSucceeds(speichern({ version: 3, children: {} }));
      await assertSucceeds(speichern(GUELTIG));
    });

    // 50 Teams and 20 Kinder are more than one request may check (1000
    // expressions): the app writes one list at a time, as here
    it('takes every Spitzname the app keeps, 30 of the longest emoji too', async () => {
      const familie = '👨🏽‍👩🏽‍👧🏽‍👦🏽';

      await assertSucceeds(
        speichern({
          version: 3,
          children: {
            4711: { since: 1, nickname: familie.repeat(NICKNAME_LENGTH) },
          },
        })
      );
    });

    it('takes both maps full, one map per write', async () => {
      const eigene = auswahlVon(db(ELTERNTEIL), ELTERNTEIL);

      await assertSucceeds(
        setDoc(eigene, { version: 3, teams: teamsVon(TEAMS_HOECHSTENS) })
      );
      await assertSucceeds(
        updateDoc(eigene, { children: volleKinder(KINDER_HOECHSTENS) })
      );
      await assertSucceeds(
        updateDoc(eigene, { teams: teamsVon(TEAMS_HOECHSTENS - 1) })
      );
      await assertSucceeds(
        updateDoc(eigene, { children: volleKinder(KINDER_HOECHSTENS - 1) })
      );
      await assertSucceeds(
        updateDoc(eigene, {
          clubColors: volleVereinsfarben(VEREINE_HOECHSTENS),
        })
      );
    });

    it('takes a full map of Vereinsfarben in the write that creates it', async () => {
      await assertSucceeds(
        speichern({
          version: 3,
          clubColors: volleVereinsfarben(VEREINE_HOECHSTENS),
        })
      );
    });

    it("takes a Verein's colours set and changed entry by entry, as the app writes them", async () => {
      await vorhanden(ELTERNTEIL, {
        ...GUELTIG,
        clubColors: volleVereinsfarben(VEREINE_HOECHSTENS - 1),
      });
      const eigene = auswahlVon(db(ELTERNTEIL), ELTERNTEIL);

      await assertSucceeds(
        setDoc(
          eigene,
          {
            version: 3,
            clubColors: { 4242: '#c8102e,#1d4ed8' },
          },
          { merge: true }
        )
      );
      await assertSucceeds(
        setDoc(
          eigene,
          {
            version: 3,
            clubColors: {
              4242: '#007a3d',
            },
          },
          { merge: true }
        )
      );
      await assertSucceeds(
        updateDoc(eigene, { 'clubColors.4242': deleteField() })
      );
    });

    it('takes a change of single entries, as the app writes them', async () => {
      await vorhanden(ELTERNTEIL, {
        version: 3,
        teams: teamsVon(TEAMS_HOECHSTENS - 1),
        children: volleKinder(KINDER_HOECHSTENS - 1),
      });
      const eigene = auswahlVon(db(ELTERNTEIL), ELTERNTEIL);

      await assertSucceeds(
        setDoc(eigene, { version: 3, teams: { 313036: 9 } }, { merge: true })
      );
      await assertSucceeds(
        updateDoc(eigene, { 'children.4711': { since: 9, nickname: 'Mimi' } })
      );
      await assertSucceeds(
        updateDoc(eigene, { 'children.4711.nickname': 'Mi' })
      );
      await assertSucceeds(
        updateDoc(eigene, { 'teams.313036': deleteField() })
      );
    });

    it('refuses an entry merged past the cap, rather than cutting it', async () => {
      await vorhanden(ELTERNTEIL, {
        version: 3,
        teams: teamsVon(TEAMS_HOECHSTENS),
      });

      await assertFails(
        setDoc(
          auswahlVon(db(ELTERNTEIL), ELTERNTEIL),
          { version: 3, teams: { 313036: 9 } },
          { merge: true }
        )
      );
    });

    it('takes ids up to 15 digits, every DBB id', async () => {
      await assertSucceeds(
        speichern({ version: 3, teams: { '999999999999999': 1 } })
      );
    });

    it('lets a map over its cap, as stored earlier, shrink one entry at a time', async () => {
      await vorhanden(ELTERNTEIL, {
        version: 3,
        teams: teamsVon(TEAMS_HOECHSTENS + 2),
        children: kinderOhneNamen(KINDER_HOECHSTENS + 1),
      });
      const eigene = auswahlVon(db(ELTERNTEIL), ELTERNTEIL);

      await assertSucceeds(updateDoc(eigene, { 'teams.100': deleteField() }));
      await assertSucceeds(
        updateDoc(eigene, { 'children.100': deleteField() })
      );
      await assertFails(updateDoc(eigene, { 'teams.999999': 1 }));
    });

    it('refuses a Spitzname for a Kind no longer marked', async () => {
      await vorhanden(ELTERNTEIL, { version: 3, children: {} });

      await assertFails(
        setDoc(
          auswahlVon(db(ELTERNTEIL), ELTERNTEIL),
          { version: 3, children: { 4711: { nickname: 'Mimi' } } },
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
      ['Kinder', { 'children.4711.vorname': 'Mimi' }],
      ['Vereinsfarben', { 'clubColors.4242': 'rot' }],
    ])('refuses to change one map into invalid %s', async (_, aenderung) => {
      await vorhanden(ELTERNTEIL);

      await assertFails(
        updateDoc(auswahlVon(db(ELTERNTEIL), ELTERNTEIL), aenderung)
      );
    });
  });
});

// the selections of versions 1 and 2 (#2966): the app moves one into
// `selections/{uid}` when the account is opened, then deletes it
describe('the legacy Auswahl document', () => {
  const LEGACY = {
    version: 2,
    teams: { 313036: 1 },
    kinder: { 4711: { seit: 2, spitzname: 'Mimi' } },
  };
  const legacyVon = (firestore: Firestore, uid: string) =>
    doc(firestore, LEGACY_CHOICES_COLLECTION, uid);
  const legacyVorhanden = (uid: string) =>
    ohneRegeln(env, (firestore) => setDoc(legacyVon(firestore, uid), LEGACY));

  it('lets the owner read and delete it', async () => {
    await legacyVorhanden(ELTERNTEIL);
    const eigene = legacyVon(db(ELTERNTEIL), ELTERNTEIL);

    await assertSucceeds(getDoc(eigene));
    await assertSucceeds(deleteDoc(eigene));
  });

  it('lets the owner read it where there is none', async () => {
    await assertSucceeds(getDoc(legacyVon(db(ELTERNTEIL), ELTERNTEIL)));
  });

  it('lets nobody create or change it, as the app of version 2 would', async () => {
    const eigene = legacyVon(db(ELTERNTEIL), ELTERNTEIL);

    await assertFails(setDoc(eigene, LEGACY));
    await legacyVorhanden(ELTERNTEIL);
    await assertFails(updateDoc(eigene, { teams: { 313036: 1, 201500: 2 } }));
  });

  it('lets nobody else near it', async () => {
    await legacyVorhanden(ELTERNTEIL);
    const fremde = legacyVon(db(ANDERES), ELTERNTEIL);

    await assertFails(getDoc(fremde));
    await assertFails(deleteDoc(fremde));
  });

  it('refuses the owner once the account is deleted', async () => {
    await legacyVorhanden(ELTERNTEIL);
    await ohneRegeln(env, (firestore) =>
      setDoc(doc(firestore, DELETED_ACCOUNTS_COLLECTION, ELTERNTEIL), {
        expireAt: new Date(),
      })
    );

    await assertFails(getDoc(legacyVon(db(ELTERNTEIL), ELTERNTEIL)));
  });
});
