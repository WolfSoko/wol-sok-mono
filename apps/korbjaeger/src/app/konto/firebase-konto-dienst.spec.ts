import type { Environment } from '../../environments/environment.type';
import {
  firebaseKontoDienst,
  ZWISCHENSPEICHER_LEEREN_SCHLUESSEL,
} from './firebase-konto-dienst';

/** Firebase, as far as the service calls it; each spec steers it. */
const firebase = vi.hoisted(() => ({
  terminate: vi.fn<() => Promise<void>>(),
  clearIndexedDbPersistence: vi.fn<() => Promise<void>>(),
  deleteDoc: vi.fn<() => Promise<void>>(),
  getDocFromServer: vi.fn<() => Promise<{ exists: () => boolean }>>(),
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

/** A device that holds no choices. */
const LEER = { teams: [], kinder: [], vereinsfarben: [] };

const UMGEBUNG = {
  firebase: { projectId: 'korbjaeger' },
} as unknown as Environment;

describe('FirebaseKontoDienst', () => {
  beforeEach(() => {
    localStorage.clear();
    firebase.terminate.mockResolvedValue(undefined);
    firebase.clearIndexedDbPersistence.mockResolvedValue(undefined);
    firebase.deleteDoc.mockResolvedValue(undefined);
    firebase.getDocFromServer.mockResolvedValue({ exists: () => false });
    firebase.waitForPendingWrites.mockResolvedValue(undefined);
  });

  afterEach(() => vi.useRealTimers());

  describe('clearing the cache', () => {
    it('never fails, and leaves the clearing to the next start where it could not', async () => {
      firebase.terminate.mockRejectedValue(new Error('beendet'));
      const warnen = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      await expect(
        firebaseKontoDienst(UMGEBUNG).zwischenspeicherLeeren()
      ).resolves.toBeUndefined();

      expect(localStorage.getItem(ZWISCHENSPEICHER_LEEREN_SCHLUESSEL)).toBe(
        '1'
      );
      expect(warnen).toHaveBeenCalled();
      warnen.mockRestore();
    });

    it('marks nothing left to clear once it cleared', async () => {
      await firebaseKontoDienst(UMGEBUNG).zwischenspeicherLeeren();

      expect(
        localStorage.getItem(ZWISCHENSPEICHER_LEEREN_SCHLUESSEL)
      ).toBeNull();
    });
  });

  it("waits for the server to confirm the document's deletion, however long", async () => {
    vi.useFakeTimers();
    const bestaetigt = Promise.withResolvers<void>();
    firebase.deleteDoc.mockReturnValue(bestaetigt.promise);
    let fertig = false;

    const loeschen = firebaseKontoDienst(UMGEBUNG)
      .auswahlLoeschen('uid-1')
      .then(() => (fertig = true));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fertig).toBe(false);

    bestaetigt.resolve();
    await loeschen;
    expect(fertig).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('deletes the legacy document of the account too', async () => {
    await firebaseKontoDienst(UMGEBUNG).auswahlLoeschen('uid-1');

    expect(firebase.deleteDoc).toHaveBeenCalledTimes(2);
  });

  // #2966: the move itself is tested on the emulator
  // (legacy-account-migration.emulator.ts)
  describe("moving the account's legacy selection", () => {
    beforeEach(() => {
      firebase.getDocFromServer.mockClear();
    });

    it('looks for it once a visit, before it opens the account or takes the device in', async () => {
      const dienst = firebaseKontoDienst(UMGEBUNG);

      await dienst.geraetUebernehmen('uid-1', LEER);
      await dienst.auswahl('uid-1', () => undefined);
      await dienst.auswahl('uid-2', () => undefined);
      await new Promise((weiter) => setTimeout(weiter));

      expect(firebase.getDocFromServer).toHaveBeenCalledTimes(2);
    });

    it('takes the device in where it fails, and tries again next time', async () => {
      const warnen = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      firebase.getDocFromServer.mockRejectedValueOnce(new Error('offline'));
      const dienst = firebaseKontoDienst(UMGEBUNG);

      await expect(
        dienst.geraetUebernehmen('uid-1', LEER)
      ).resolves.toBeDefined();
      await dienst.auswahl('uid-1', () => undefined);
      await new Promise((weiter) => setTimeout(weiter));

      expect(firebase.getDocFromServer).toHaveBeenCalledTimes(2);
      expect(warnen).toHaveBeenCalled();
      warnen.mockRestore();
    });

    it('opens the account without waiting for it, as the listener shows it', async () => {
      firebase.getDocFromServer.mockReturnValue(new Promise(() => undefined));

      await expect(
        firebaseKontoDienst(UMGEBUNG).auswahl('uid-1', () => undefined)
      ).resolves.toBeDefined();
    });

    it('takes the device in only once it moved, the account’s older choices first', async () => {
      const gelesen = Promise.withResolvers<{ exists: () => boolean }>();
      firebase.getDocFromServer.mockReturnValue(gelesen.promise);
      let uebernommen = false;

      const uebernahme = firebaseKontoDienst(UMGEBUNG)
        .geraetUebernehmen('uid-1', LEER)
        .then(() => (uebernommen = true));
      await Promise.resolve();
      expect(uebernommen).toBe(false);

      gelesen.resolve({ exists: () => false });
      await uebernahme;
      expect(uebernommen).toBe(true);
    });

    it('deletes the account’s documents only once a move still running ended', async () => {
      const gelesen = Promise.withResolvers<{ exists: () => boolean }>();
      firebase.getDocFromServer.mockReturnValue(gelesen.promise);
      firebase.deleteDoc.mockClear();
      const dienst = firebaseKontoDienst(UMGEBUNG);
      await dienst.auswahl('uid-1', () => undefined);

      const loeschen = dienst.auswahlLoeschen('uid-1');
      await new Promise((weiter) => setTimeout(weiter));
      expect(firebase.deleteDoc).not.toHaveBeenCalled();

      gelesen.resolve({ exists: () => false });
      await loeschen;
      expect(firebase.deleteDoc).toHaveBeenCalledTimes(2);
    });
  });

  describe('whether all was sent', () => {
    it('says so once the writes are sent, no timer left', async () => {
      vi.useFakeTimers();
      const dienst = firebaseKontoDienst(UMGEBUNG);
      await dienst.auswahl('uid-1', () => undefined);

      await expect(dienst.allesGesendet()).resolves.toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('says no after five seconds, no timer left', async () => {
      vi.useFakeTimers();
      firebase.waitForPendingWrites.mockReturnValue(
        new Promise(() => undefined)
      );
      const dienst = firebaseKontoDienst(UMGEBUNG);
      await dienst.auswahl('uid-1', () => undefined);

      const gesendet = dienst.allesGesendet();
      await vi.advanceTimersByTimeAsync(5000);

      await expect(gesendet).resolves.toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
