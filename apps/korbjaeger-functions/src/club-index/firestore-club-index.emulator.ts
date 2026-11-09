import { assertFails } from '@firebase/rules-unit-testing';
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

    expect(await store.all()).toEqual([
      { ...BAYERN, clubs: [], updatedAt: BAYERN.updatedAt + 1 },
      { ...BAYERN, association: { id: 3, name: 'Berlin' } },
    ]);
  });

  it('skips a list it cannot read', async () => {
    await project()
      .admin.collection(CLUB_INDEX_COLLECTION)
      .doc('9')
      .set({ version: 99 });

    expect(await firestoreClubIndex(project().admin).all()).toEqual([]);
  });

  it('stays closed to devices under the app’s rules', async () => {
    await firestoreClubIndex(project().admin).save(BAYERN);
    const device = project().devices.authenticatedContext('elternteil-a');

    await assertFails(
      device.firestore().collection(CLUB_INDEX_COLLECTION).doc('2').get()
    );
  });
});
