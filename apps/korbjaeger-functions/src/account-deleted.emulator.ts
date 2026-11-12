import { assertSucceeds } from '@firebase/rules-unit-testing';
import { Timestamp } from 'firebase-admin/firestore';
import {
  DELETED_ACCOUNTS_COLLECTION,
  CHOICES_COLLECTION,
  TOMBSTONE_DURATION_MS,
} from '@wolsok/feat-shared-korbjaeger-account';
import { accountDeleted } from './account-deleted';
import { useEmulatorProject } from './testing/emulator';

const PARENT = 'parent-a';
const OTHER_PARENT = 'parent-b';
const NOW = Date.UTC(2026, 10, 9, 12);

const SELECTION_DOCUMENT = {
  version: 3,
  teams: { 313036: 1 },
  children: { 4711: { since: 1, nickname: 'Mimi' } },
};

const project = useEmulatorProject();

const selectionOf = (uid: string) =>
  project().admin.collection(CHOICES_COLLECTION).doc(uid);

const tombstoneOf = (uid: string) =>
  project().admin.collection(DELETED_ACCOUNTS_COLLECTION).doc(uid);

/** A device signed in as `uid`, under the app's rules. */
const signedInDevice = (uid: string) =>
  project().devices.authenticatedContext(uid).firestore();

/** What a device writes when the Elternteil follows the Team `id`. */
const follow = (
  device: ReturnType<typeof signedInDevice>,
  uid: string,
  id: number
) =>
  device
    .collection(CHOICES_COLLECTION)
    .doc(uid)
    .set({ version: 3, teams: { [id]: id } }, { merge: true });

describe('accountDeleted', () => {
  it('leaves a tombstone of a day and no selection of the account', async () => {
    await selectionOf(PARENT).set(SELECTION_DOCUMENT);

    await accountDeleted(project().admin, PARENT, NOW);

    expect((await selectionOf(PARENT).get()).exists).toBe(false);
    expect((await tombstoneOf(PARENT).get()).data()).toEqual({
      expireAt: Timestamp.fromMillis(NOW + TOMBSTONE_DURATION_MS),
    });
  });

  it("leaves other accounts' selections as they are", async () => {
    await selectionOf(OTHER_PARENT).set(SELECTION_DOCUMENT);

    await accountDeleted(project().admin, PARENT, NOW);

    expect((await selectionOf(OTHER_PARENT).get()).data()).toEqual(
      SELECTION_DOCUMENT
    );
    expect((await tombstoneOf(OTHER_PARENT).get()).exists).toBe(false);
  });

  it('ends the same on a retry after it succeeded', async () => {
    await selectionOf(PARENT).set(SELECTION_DOCUMENT);
    await accountDeleted(project().admin, PARENT, NOW);

    await accountDeleted(project().admin, PARENT, NOW);

    expect((await selectionOf(PARENT).get()).exists).toBe(false);
    expect((await tombstoneOf(PARENT).get()).exists).toBe(true);
  });

  it('ends the same on a retry after it failed between its steps', async () => {
    await selectionOf(PARENT).set(SELECTION_DOCUMENT);
    // the tombstone was written, the deletion failed
    await tombstoneOf(PARENT).set({ expireAt: Timestamp.fromMillis(1) });

    await accountDeleted(project().admin, PARENT, NOW);

    expect((await selectionOf(PARENT).get()).exists).toBe(false);
    expect((await tombstoneOf(PARENT).get()).data()).toEqual({
      expireAt: Timestamp.fromMillis(NOW + TOMBSTONE_DURATION_MS),
    });
  });

  // #2912: a second device signed in to the account keeps its token for up
  // to an hour after the deletion and may write the whole time
  it('leaves nothing while a second device of the account keeps writing', async () => {
    await selectionOf(PARENT).set(SELECTION_DOCUMENT);
    const deleting = signedInDevice(PARENT);
    const other = signedInDevice(PARENT);
    let deleted = false;
    const afterDeletion: boolean[] = [];
    let firstStored!: () => void;
    const storedOnce = new Promise<void>((r) => (firstStored = r));

    // the deleting device deletes the document; the other one writes it anew
    await assertSucceeds(
      deleting.collection(CHOICES_COLLECTION).doc(PARENT).delete()
    );
    await assertSucceeds(follow(other, PARENT, 99));
    expect((await selectionOf(PARENT).get()).exists).toBe(true);

    // and keeps writing while the Auth deletion's trigger runs, and after
    const writing = (async () => {
      for (let id = 100; afterDeletion.length < 5; id++) {
        const afterwards = deleted;
        const stored = await follow(other, PARENT, id).then(
          () => true,
          () => false
        );
        if (afterwards) {
          afterDeletion.push(stored);
        } else if (stored) {
          firstStored();
        }
      }
    })();
    await storedOnce;
    await accountDeleted(project().admin, PARENT, NOW);
    deleted = true;
    await writing;

    expect(afterDeletion).toEqual([false, false, false, false, false]);
    expect((await selectionOf(PARENT).get()).exists).toBe(false);
  });
});
