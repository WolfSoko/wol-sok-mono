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
  LEGACY_CHOICES_COLLECTION,
  CHOICES_COLLECTION,
  CLUB_INDEX_COLLECTION,
} from '@wolsok/feat-shared-korbjaeger-account';
import {
  asDevice,
  APP_RULES,
  emulatorProject,
  withoutRules,
  seed,
} from './testing/firestore-emulator';

/**
 * The app's Firestore rules (`../firestore.rules`) on the emulator: one
 * `selections/{uid}` per signed-in Elternteil, only theirs, with only the
 * fields the `Selection` stores (ADR 0019) and maps capped as the app caps
 * them (`SELECTION_LIMITS`).
 */
let env: RulesTestEnvironment;

const {
  teams: MAX_TEAMS,
  children: MAX_CHILDREN,
  clubColors: MAX_CLUBS,
} = SELECTION_LIMITS;

const PARENT = 'elternteil-a';
const OTHER_PARENT = 'elternteil-b';

const VALID = {
  version: 3,
  teams: { 313036: 1, 201500: 2 },
  children: { 4711: { since: 1, nickname: 'Mimi' }, 4712: { since: 2 } },
};

beforeAll(async () => {
  env = await emulatorProject('demo-korbjaeger-rules', APP_RULES);
});

afterAll(() => env.cleanup());

beforeEach(() => env.clearFirestore());

const db = (uid: string): Firestore => asDevice(env, uid);

const withoutAccount = (): Firestore =>
  env.unauthenticatedContext().firestore() as unknown as Firestore;

const selectionOf = (firestore: Firestore, uid: string) =>
  doc(firestore, CHOICES_COLLECTION, uid);

/** Writes past the rules, as an earlier write did. */
const existing = (uid: string, data: object = VALID) => seed(env, uid, data);

/** Whether the owner may store `data` as their Auswahl. */
const save = (data: object) => setDoc(selectionOf(db(PARENT), PARENT), data);

const numbers = (count: number, from = 100): number[] =>
  Array.from({ length: count }, (_, i) => from + i);

/** `count` Teams, keyed by id, each followed since its place. */
const teamsOf = (count: number): Record<string, number> =>
  Object.fromEntries(numbers(count).map((id, since) => [id, since]));

const childrenWithoutNames = (count: number) =>
  Object.fromEntries(numbers(count).map((id, since) => [id, { since }]));

/** Kinder, each with a Spitzname as long as the rules take. */
const fullChildren = (count: number) =>
  Object.fromEntries(
    numbers(count).map((id, since) => [
      id,
      { since, nickname: 'x'.repeat(NICKNAME_CODE_POINTS) },
    ])
  );

/** Vereinsfarben, each Verein with both colours. */
const fullClubColors = (count: number) =>
  Object.fromEntries(numbers(count).map((id) => [id, '#c8102e,#1d4ed8']));

/** Documents the rules refuse, whether created or changed into. */
const INVALID: ReadonlyArray<readonly [string, object]> = [
  ['a field it does not know', { ...VALID, name: 'Mimi Muster' }],
  ['a document without a version', { teams: {} }],
  ['a document of version 2', { ...VALID, version: 2 }],
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
  ['a version that is no number', { ...VALID, version: '3' }],
  ['more Teams than the cap', { version: 3, teams: teamsOf(MAX_TEAMS + 1) }],
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
    { version: 3, teams: { ...teamsOf(MAX_TEAMS - 1), 999999: 'x' } },
  ],
  [
    'more Kinder than the cap',
    { version: 3, children: childrenWithoutNames(MAX_CHILDREN + 1) },
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
    { version: 3, clubColors: fullClubColors(MAX_CLUBS + 1) },
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
        ...fullClubColors(MAX_CLUBS - 1),
        999999: 'x',
      },
    },
  ],
  [
    'an invalid Kind at the end',
    {
      version: 3,
      children: {
        ...childrenWithoutNames(MAX_CHILDREN - 1),
        999999: { since: 'x' },
      },
    },
  ],
];

describe('the Auswahl document', () => {
  describe('who may', () => {
    it('lets the owner create, read, change and delete it', async () => {
      const own = selectionOf(db(PARENT), PARENT);

      await assertSucceeds(setDoc(own, VALID));
      await assertSucceeds(getDoc(own));
      await assertSucceeds(updateDoc(own, { teams: { 313036: 3 } }));
      await assertSucceeds(deleteDoc(own));
    });

    it('lets nobody else read, write or delete it', async () => {
      await existing(PARENT);
      const foreign = selectionOf(db(OTHER_PARENT), PARENT);

      await assertFails(getDoc(foreign));
      await assertFails(setDoc(foreign, VALID));
      await assertFails(updateDoc(foreign, { teams: {} }));
      await assertFails(deleteDoc(foreign));
    });

    it('lets nobody without an account near it', async () => {
      await existing(PARENT);
      const without = selectionOf(withoutAccount(), PARENT);

      await assertFails(getDoc(without));
      await assertFails(setDoc(without, VALID));
      await assertFails(deleteDoc(without));
    });

    it('lists nobody the documents of all', async () => {
      await existing(PARENT);

      await assertFails(getDocs(collection(db(PARENT), CHOICES_COLLECTION)));
    });

    it('keeps the club index closed: only the functions write and the server reads it', async () => {
      await withoutRules(env, (admin) =>
        setDoc(doc(admin, CLUB_INDEX_COLLECTION, '7'), { version: 1 })
      );

      for (const client of [db(PARENT), withoutAccount()]) {
        await assertFails(getDoc(doc(client, CLUB_INDEX_COLLECTION, '7')));
        await assertFails(getDocs(collection(client, CLUB_INDEX_COLLECTION)));
        await assertFails(setDoc(doc(client, CLUB_INDEX_COLLECTION, '8'), {}));
      }
    });

    it('keeps every other collection closed', async () => {
      await assertFails(setDoc(doc(db(PARENT), 'andere', PARENT), {}));
      await assertFails(getDoc(doc(db(PARENT), 'andere', PARENT)));
    });
  });

  // the Auth deletion's trigger (korbjaeger-functions, `accountDeleted`)
  // writes the tombstone first: a second device's token stays valid for up
  // to an hour, so the rules refuse it from then on
  describe('once the account is deleted', () => {
    const tombstone = (uid: string) =>
      withoutRules(env, (firestore) =>
        setDoc(doc(firestore, DELETED_ACCOUNTS_COLLECTION, uid), {
          expireAt: new Date(),
        })
      );

    it('refuses the owner every request on the Auswahl', async () => {
      await existing(PARENT);
      await tombstone(PARENT);
      const own = selectionOf(db(PARENT), PARENT);

      await assertFails(getDoc(own));
      await assertFails(setDoc(own, VALID));
      await assertFails(updateDoc(own, { teams: { 313036: 3 } }));
      await assertFails(deleteDoc(own));
    });

    it('refuses the owner creating it anew', async () => {
      await tombstone(PARENT);

      await assertFails(save(VALID));
    });

    it('leaves other accounts alone', async () => {
      await tombstone(OTHER_PARENT);

      await assertSucceeds(save(VALID));
    });

    it('lets no client read or write the tombstone', async () => {
      await tombstone(PARENT);
      const ownDocument = doc(db(PARENT), DELETED_ACCOUNTS_COLLECTION, PARENT);

      await assertFails(getDoc(ownDocument));
      await assertFails(deleteDoc(ownDocument));
      await assertFails(
        setDoc(
          doc(db(OTHER_PARENT), DELETED_ACCOUNTS_COLLECTION, OTHER_PARENT),
          {}
        )
      );
    });
  });

  describe('what it holds', () => {
    it('takes a document with only the version, Teams or Kinder', async () => {
      await assertSucceeds(save({ version: 3 }));
      await assertSucceeds(save({ version: 3, teams: { 313036: 1 } }));
      await assertSucceeds(save({ version: 3, children: {} }));
      await assertSucceeds(save(VALID));
    });

    // 50 Teams and 20 Kinder are more than one request may check (1000
    // expressions): the app writes one list at a time, as here
    it('takes every Spitzname the app keeps, 30 of the longest emoji too', async () => {
      const family = '👨🏽‍👩🏽‍👧🏽‍👦🏽';

      await assertSucceeds(
        save({
          version: 3,
          children: {
            4711: { since: 1, nickname: family.repeat(NICKNAME_LENGTH) },
          },
        })
      );
    });

    it('takes both maps full, one map per write', async () => {
      const own = selectionOf(db(PARENT), PARENT);

      await assertSucceeds(
        setDoc(own, { version: 3, teams: teamsOf(MAX_TEAMS) })
      );
      await assertSucceeds(
        updateDoc(own, { children: fullChildren(MAX_CHILDREN) })
      );
      await assertSucceeds(updateDoc(own, { teams: teamsOf(MAX_TEAMS - 1) }));
      await assertSucceeds(
        updateDoc(own, { children: fullChildren(MAX_CHILDREN - 1) })
      );
      await assertSucceeds(
        updateDoc(own, {
          clubColors: fullClubColors(MAX_CLUBS),
        })
      );
    });

    it('takes a full map of Vereinsfarben in the write that creates it', async () => {
      await assertSucceeds(
        save({
          version: 3,
          clubColors: fullClubColors(MAX_CLUBS),
        })
      );
    });

    it("takes a Verein's colours set and changed entry by entry, as the app writes them", async () => {
      await existing(PARENT, {
        ...VALID,
        clubColors: fullClubColors(MAX_CLUBS - 1),
      });
      const own = selectionOf(db(PARENT), PARENT);

      await assertSucceeds(
        setDoc(
          own,
          {
            version: 3,
            clubColors: { 4242: '#c8102e,#1d4ed8' },
          },
          { merge: true }
        )
      );
      await assertSucceeds(
        setDoc(
          own,
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
        updateDoc(own, { 'clubColors.4242': deleteField() })
      );
    });

    it('takes a change of single entries, as the app writes them', async () => {
      await existing(PARENT, {
        version: 3,
        teams: teamsOf(MAX_TEAMS - 1),
        children: fullChildren(MAX_CHILDREN - 1),
      });
      const own = selectionOf(db(PARENT), PARENT);

      await assertSucceeds(
        setDoc(own, { version: 3, teams: { 313036: 9 } }, { merge: true })
      );
      await assertSucceeds(
        updateDoc(own, { 'children.4711': { since: 9, nickname: 'Mimi' } })
      );
      await assertSucceeds(updateDoc(own, { 'children.4711.nickname': 'Mi' }));
      await assertSucceeds(updateDoc(own, { 'teams.313036': deleteField() }));
    });

    it('refuses an entry merged past the cap, rather than cutting it', async () => {
      await existing(PARENT, {
        version: 3,
        teams: teamsOf(MAX_TEAMS),
      });

      await assertFails(
        setDoc(
          selectionOf(db(PARENT), PARENT),
          { version: 3, teams: { 313036: 9 } },
          { merge: true }
        )
      );
    });

    it('takes ids up to 15 digits, every DBB id', async () => {
      await assertSucceeds(
        save({ version: 3, teams: { '999999999999999': 1 } })
      );
    });

    it('lets a map over its cap, as stored earlier, shrink one entry at a time', async () => {
      await existing(PARENT, {
        version: 3,
        teams: teamsOf(MAX_TEAMS + 2),
        children: childrenWithoutNames(MAX_CHILDREN + 1),
      });
      const own = selectionOf(db(PARENT), PARENT);

      await assertSucceeds(updateDoc(own, { 'teams.100': deleteField() }));
      await assertSucceeds(updateDoc(own, { 'children.100': deleteField() }));
      await assertFails(updateDoc(own, { 'teams.999999': 1 }));
    });

    it('refuses a Spitzname for a Kind no longer marked', async () => {
      await existing(PARENT, { version: 3, children: {} });

      await assertFails(
        setDoc(
          selectionOf(db(PARENT), PARENT),
          { version: 3, children: { 4711: { nickname: 'Mimi' } } },
          { merge: true }
        )
      );
    });

    it.each(INVALID)('refuses to create %s', async (_, data) => {
      await assertFails(save(data));
    });

    it.each(INVALID)('refuses to change a valid one to %s', async (_, data) => {
      await existing(PARENT);

      await assertFails(save(data));
    });

    it.each([
      ['Teams', { 'teams.313036': 'Mimi Muster' }],
      ['Kinder', { 'children.4711.vorname': 'Mimi' }],
      ['Vereinsfarben', { 'clubColors.4242': 'rot' }],
    ])('refuses to change one map into invalid %s', async (_, change) => {
      await existing(PARENT);

      await assertFails(updateDoc(selectionOf(db(PARENT), PARENT), change));
    });
  });
});

// the selections of versions 1 and 2, before #2966: none is left (#2983),
// and no client may open one any more
describe('the Auswahl document of before #2966', () => {
  const legacyOf = (firestore: Firestore, uid: string) =>
    doc(firestore, LEGACY_CHOICES_COLLECTION, uid);

  it('is closed to its owner too', async () => {
    await withoutRules(env, (firestore) =>
      setDoc(legacyOf(firestore, PARENT), {
        version: 2,
        teams: { 313036: 1 },
      })
    );
    const own = legacyOf(db(PARENT), PARENT);

    await assertFails(getDoc(own));
    await assertFails(deleteDoc(own));
    await assertFails(setDoc(own, { version: 2 }));
  });
});
