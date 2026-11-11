import { assertFails } from '@firebase/rules-unit-testing';
import { storedAssociationClubs } from '@wolsok/feat-shared-basketball-data';
import { CLUB_INDEX_COLLECTION } from '@wolsok/feat-shared-korbjaeger-account';
import { useEmulatorProject } from '../testing/emulator';
import { firestoreClubIndex } from './firestore-club-index';

const project = useEmulatorProject();

const BAYERN = {
  association: { id: 2, name: 'Bayern' },
  clubs: [{ id: 1476, name: 'Post SV Nürnberg' }],
  updatedAt: Date.UTC(2026, 10, 9),
};

describe('the club index in Firestore', () => {
  it('stores one list per Association and reads them back', async () => {
    const store = firestoreClubIndex(project().admin);

    await store.save(BAYERN);
    await store.save({ ...BAYERN, clubs: [], updatedAt: BAYERN.updatedAt + 1 });
    await store.save({ ...BAYERN, association: { id: 3, name: 'Berlin' } });

    expect((await store.read()).lists).toEqual([
      { ...BAYERN, clubs: [], updatedAt: BAYERN.updatedAt + 1 },
      { ...BAYERN, association: { id: 3, name: 'Berlin' } },
    ]);
  });

  it('notes an attempt beside the list, and drops it with the next save', async () => {
    const store = firestoreClubIndex(project().admin);
    await store.save(BAYERN);

    await store.markAttempt(2, 42);
    await store.markAttempt(6, 43);

    const marked = await store.read();
    expect(marked.lists).toEqual([BAYERN]);
    expect([...marked.attempts]).toEqual([
      [2, 42],
      [6, 43],
    ]);

    await store.save(BAYERN);
    expect([...(await store.read()).attempts]).toEqual([[6, 43]]);
  });

  it('notes offered Verbände without a list, and replaces a note with the saved list', async () => {
    const store = firestoreClubIndex(project().admin);
    await store.save(BAYERN);

    await store.noteOffered([3, 6]);
    await store.markAttempt(3, 43);

    const noted = await store.read();
    expect(noted.lists).toEqual([BAYERN]);
    expect([...noted.ids]).toEqual([2, 3, 6]);
    expect([...noted.offered]).toEqual([2, 3, 6]);
    expect([...noted.attempts]).toEqual([[3, 43]]);

    await store.save({ ...BAYERN, association: { id: 3, name: 'Berlin' } });
    const saved = await project()
      .admin.collection(CLUB_INDEX_COLLECTION)
      .doc('3')
      .get();
    expect(saved.get('offered')).toBe(true);
    expect(saved.get('attemptedAt')).toBeUndefined();
  });

  it('marks a list stored before it noted Verbände, keeping the list', async () => {
    const { offered: _offered, ...unmarked } = storedAssociationClubs(BAYERN);
    await project()
      .admin.collection(CLUB_INDEX_COLLECTION)
      .doc('2')
      .set(unmarked);
    const store = firestoreClubIndex(project().admin);
    expect([...(await store.read()).offered]).toEqual([]);

    await store.noteOffered([2]);

    const read = await store.read();
    expect(read.lists).toEqual([BAYERN]);
    expect([...read.offered]).toEqual([2]);
  });

  it('deletes a list and a note', async () => {
    const store = firestoreClubIndex(project().admin);
    await store.save(BAYERN);

    await store.noteOffered([3]);

    await store.remove(2);
    await store.remove(3);

    const read = await store.read();
    expect(read.lists).toEqual([]);
    expect([...read.ids]).toEqual([]);
  });

  it('skips a list it cannot read', async () => {
    await project()
      .admin.collection(CLUB_INDEX_COLLECTION)
      .doc('9')
      .set({ version: 99 });

    expect((await firestoreClubIndex(project().admin).read()).lists).toEqual(
      []
    );
  });

  it('stays closed to devices under the app’s rules', async () => {
    await firestoreClubIndex(project().admin).save(BAYERN);
    const device = project().devices.authenticatedContext('elternteil-a');

    await assertFails(
      device.firestore().collection(CLUB_INDEX_COLLECTION).doc('2').get()
    );
  });

  it('dates a Verband without a list and keeps its last error, both dropped by the next save (#3022)', async () => {
    const store = firestoreClubIndex(project().admin);

    await store.markAttempt(2, 50, 40);
    await store.markFailure(2, 'unavailable: DBB down');
    await store.markAttempt(3, 51);

    const marked = await store.read();
    expect([...marked.attempts]).toEqual([
      [2, 50],
      [3, 51],
    ]);
    expect([...marked.listlessSince]).toEqual([[2, 40]]);
    expect([...marked.lastErrors]).toEqual([[2, 'unavailable: DBB down']]);

    await store.save(BAYERN);
    const saved = await store.read();
    expect([...saved.listlessSince]).toEqual([]);
    expect([...saved.lastErrors]).toEqual([]);
  });
});
