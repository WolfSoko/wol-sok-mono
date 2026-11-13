import type { Environment } from '../../environments/environment.type';
import {
  firebaseAccountService,
  CLEAR_CACHE_KEY,
} from './firebase-account-service';

/** Firebase, as far as the service calls it; each spec steers it. */
const firebase = vi.hoisted(() => ({
  terminate: vi.fn<() => Promise<void>>(),
  clearIndexedDbPersistence: vi.fn<() => Promise<void>>(),
  deleteDoc: vi.fn<() => Promise<void>>(),
  waitForPendingWrites: vi.fn<() => Promise<void>>(),
}));

vi.mock('firebase/app', () => ({ initializeApp: () => ({}) }));
vi.mock('firebase/auth', () => ({
  browserLocalPersistence: {},
  browserPopupRedirectResolver: {},
  connectAuthEmulator: vi.fn(),
  deleteUser: vi.fn(),
  GoogleAuthProvider: class {},
  indexedDBLocalPersistence: {},
  initializeAuth: () => ({ currentUser: null }),
  onAuthStateChanged: vi.fn(),
  reauthenticateWithPopup: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  ...firebase,
  connectFirestoreEmulator: vi.fn(),
  deleteField: vi.fn(),
  doc: vi.fn(() => ({})),
  initializeFirestore: () => ({}),
  onSnapshot: vi.fn(),
  persistentLocalCache: vi.fn(),
  persistentMultipleTabManager: vi.fn(),
  runTransaction: vi.fn(),
  setDoc: vi.fn(),
}));

const ENVIRONMENT = {
  firebase: { projectId: 'korbjaeger' },
} as unknown as Environment;

describe('FirebaseKontoDienst', () => {
  beforeEach(() => {
    localStorage.clear();
    firebase.terminate.mockResolvedValue(undefined);
    firebase.clearIndexedDbPersistence.mockResolvedValue(undefined);
    firebase.deleteDoc.mockResolvedValue(undefined);
    firebase.waitForPendingWrites.mockResolvedValue(undefined);
  });

  afterEach(() => vi.useRealTimers());

  describe('clearing the cache', () => {
    it('never fails, and leaves the clearing to the next start where it could not', async () => {
      firebase.terminate.mockRejectedValue(new Error('beendet'));
      const warn = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      await expect(
        firebaseAccountService(ENVIRONMENT).clearCache()
      ).resolves.toBeUndefined();

      expect(localStorage.getItem(CLEAR_CACHE_KEY)).toBe('1');
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('marks nothing left to clear once it cleared', async () => {
      await firebaseAccountService(ENVIRONMENT).clearCache();

      expect(localStorage.getItem(CLEAR_CACHE_KEY)).toBeNull();
    });
  });

  it("waits for the server to confirm the document's deletion, however long", async () => {
    vi.useFakeTimers();
    const confirmed = Promise.withResolvers<void>();
    firebase.deleteDoc.mockReturnValue(confirmed.promise);
    let done = false;

    const deletion = firebaseAccountService(ENVIRONMENT)
      .deleteSelection('uid-1')
      .then(() => (done = true));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(done).toBe(false);

    confirmed.resolve();
    await deletion;
    expect(done).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("deletes the account's document only", async () => {
    firebase.deleteDoc.mockClear();

    await firebaseAccountService(ENVIRONMENT).deleteSelection('uid-1');

    expect(firebase.deleteDoc).toHaveBeenCalledTimes(1);
  });

  describe('whether all was sent', () => {
    it('says so once the writes are sent, no timer left', async () => {
      vi.useFakeTimers();
      const service = firebaseAccountService(ENVIRONMENT);
      await service.selection('uid-1', () => undefined);

      await expect(service.allSent()).resolves.toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('says no after five seconds, no timer left', async () => {
      vi.useFakeTimers();
      firebase.waitForPendingWrites.mockReturnValue(
        new Promise(() => undefined)
      );
      const service = firebaseAccountService(ENVIRONMENT);
      await service.selection('uid-1', () => undefined);

      const sent = service.allSent();
      await vi.advanceTimersByTimeAsync(5000);

      await expect(sent).resolves.toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
