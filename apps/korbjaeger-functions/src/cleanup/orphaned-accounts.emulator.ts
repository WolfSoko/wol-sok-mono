import {
  CHOICES_COLLECTION,
  DELETED_ACCOUNTS_COLLECTION,
  LEGACY_CHOICES_COLLECTION,
} from '@wolsok/feat-shared-korbjaeger-account';
import { reportText } from './cleanup-cli';
import { useEmulatorProject } from '../testing/emulator';
import {
  cleanUpOrphanedAccounts,
  type ExistingAccounts,
  findOrphanedAccounts,
} from './orphaned-accounts';

const SELECTION = { version: 3, teams: { 313036: 1 } };
const LEGACY_SELECTION = { version: 2, teams: { 313036: 1 } };

const LIVING = 'living-parent';
const DELETED = 'deleted-parent';
const DELETED_LEGACY = 'deleted-legacy-parent';

const project = useEmulatorProject();

/** Auth as a fake: knows only `living`, records every lookup. */
function fakeAccounts(living: readonly string[]): ExistingAccounts & {
  readonly lookups: string[][];
} {
  const lookups: string[][] = [];
  return {
    lookups,
    async missing(uids) {
      lookups.push([...uids]);
      return new Set(uids.filter((uid) => !living.includes(uid)));
    },
  };
}

const doc = (collection: string, uid: string) =>
  project().admin.collection(collection).doc(uid);

const exists = async (collection: string, uid: string) =>
  (await doc(collection, uid).get()).exists;

async function seed(): Promise<void> {
  await Promise.all([
    doc(CHOICES_COLLECTION, LIVING).set(SELECTION),
    doc(LEGACY_CHOICES_COLLECTION, LIVING).set(LEGACY_SELECTION),
    doc(CHOICES_COLLECTION, DELETED).set(SELECTION),
    doc(LEGACY_CHOICES_COLLECTION, DELETED).set(LEGACY_SELECTION),
    doc(LEGACY_CHOICES_COLLECTION, DELETED_LEGACY).set(LEGACY_SELECTION),
  ]);
}

describe('findOrphanedAccounts', () => {
  it('finds each account without an Auth user once, in both collections', async () => {
    await seed();
    const accounts = fakeAccounts([LIVING]);

    const search = await findOrphanedAccounts(project().admin, accounts);

    expect([...search.orphans].sort()).toEqual(
      [DELETED, DELETED_LEGACY].sort()
    );
    expect(search.documentsListed).toEqual({
      [CHOICES_COLLECTION]: 2,
      [LEGACY_CHOICES_COLLECTION]: 3,
    });
    expect(accounts.lookups).toHaveLength(1);
    expect([...accounts.lookups[0]].sort()).toEqual(
      [DELETED, DELETED_LEGACY, LIVING].sort()
    );
  });

  it('finds nothing in an empty database', async () => {
    const search = await findOrphanedAccounts(
      project().admin,
      fakeAccounts([])
    );

    expect(search.orphans).toEqual([]);
  });
});

describe('cleanUpOrphanedAccounts', () => {
  it('only counts in a dry run', async () => {
    await seed();

    const report = await cleanUpOrphanedAccounts(
      project().admin,
      fakeAccounts([LIVING]),
      { deleteOrphans: false }
    );

    expect(report).toEqual({
      documentsListed: {
        [CHOICES_COLLECTION]: 2,
        [LEGACY_CHOICES_COLLECTION]: 3,
      },
      orphansFound: 2,
      orphansDeleted: 0,
    });
    expect(await exists(CHOICES_COLLECTION, DELETED)).toBe(true);
    expect(await exists(LEGACY_CHOICES_COLLECTION, DELETED_LEGACY)).toBe(true);
    expect(await exists(DELETED_ACCOUNTS_COLLECTION, DELETED)).toBe(false);
  });

  it("deletes the orphans' documents, tombstoned, and keeps the living", async () => {
    await seed();

    const report = await cleanUpOrphanedAccounts(
      project().admin,
      fakeAccounts([LIVING]),
      { deleteOrphans: true }
    );

    expect(report.orphansDeleted).toBe(2);
    for (const uid of [DELETED, DELETED_LEGACY]) {
      expect(await exists(CHOICES_COLLECTION, uid)).toBe(false);
      expect(await exists(LEGACY_CHOICES_COLLECTION, uid)).toBe(false);
      expect(await exists(DELETED_ACCOUNTS_COLLECTION, uid)).toBe(true);
    }
    expect((await doc(CHOICES_COLLECTION, LIVING).get()).data()).toEqual(
      SELECTION
    );
    expect((await doc(LEGACY_CHOICES_COLLECTION, LIVING).get()).data()).toEqual(
      LEGACY_SELECTION
    );
    expect(await exists(DELETED_ACCOUNTS_COLLECTION, LIVING)).toBe(false);
  });

  it('ends the same when run again', async () => {
    await seed();
    const accounts = fakeAccounts([LIVING]);
    await cleanUpOrphanedAccounts(project().admin, accounts, {
      deleteOrphans: true,
    });

    const again = await cleanUpOrphanedAccounts(project().admin, accounts, {
      deleteOrphans: true,
    });

    expect(again).toMatchObject({ orphansFound: 0, orphansDeleted: 0 });
    expect(await exists(CHOICES_COLLECTION, LIVING)).toBe(true);
  });

  it('refuses to delete when Auth knows none of the accounts', async () => {
    await seed();

    await expect(
      cleanUpOrphanedAccounts(project().admin, fakeAccounts([]), {
        deleteOrphans: true,
      })
    ).rejects.toThrow('Auth knows none');

    expect(await exists(CHOICES_COLLECTION, LIVING)).toBe(true);
    expect(await exists(CHOICES_COLLECTION, DELETED)).toBe(true);
  });

  it('counts every account orphaned in a dry run without refusing', async () => {
    await seed();

    const report = await cleanUpOrphanedAccounts(
      project().admin,
      fakeAccounts([]),
      { deleteOrphans: false }
    );

    expect(report.orphansFound).toBe(3);
  });

  it('deletes nothing when the account lookup fails', async () => {
    await seed();
    const failing: ExistingAccounts = {
      missing: () => Promise.reject(new Error('Auth unavailable')),
    };

    await expect(
      cleanUpOrphanedAccounts(project().admin, failing, {
        deleteOrphans: true,
      })
    ).rejects.toThrow('Auth unavailable');

    expect(await exists(CHOICES_COLLECTION, DELETED)).toBe(true);
    expect(await exists(LEGACY_CHOICES_COLLECTION, DELETED_LEGACY)).toBe(true);
  });

  it('reports counts only, never a uid', async () => {
    await seed();

    const report = await cleanUpOrphanedAccounts(
      project().admin,
      fakeAccounts([LIVING]),
      { deleteOrphans: true }
    );
    const text = reportText(
      { project: 'demo-korbjaeger', deleteOrphans: true },
      { firestore: 'emulator', auth: 'emulator' },
      report
    );

    for (const uid of [LIVING, DELETED, DELETED_LEGACY]) {
      expect(text).not.toContain(uid);
    }
    expect(JSON.stringify(report)).not.toMatch(/parent/);
  });
});
