import type { Firestore } from 'firebase/firestore';
import { FirestoreAuswahl } from './firestore-auswahl';

/** The listener Firestore was given, steered by each spec. */
const listener = vi.hoisted(() => ({
  weiter: undefined as ((stand: unknown) => void) | undefined,
  fehler: undefined as ((fehler: unknown) => void) | undefined,
}));

vi.mock('firebase/firestore', () => ({
  deleteField: vi.fn(),
  doc: vi.fn(() => ({})),
  onSnapshot: vi.fn(
    (
      _: unknown,
      weiter: (stand: unknown) => void,
      fehler: (f: unknown) => void
    ) => {
      listener.weiter = weiter;
      listener.fehler = fehler;
      return () => undefined;
    }
  ),
  setDoc: vi.fn(() => new Promise(() => undefined)),
}));

/** A snapshot of `daten`, as the server tells it. */
const stand = (daten: unknown) => ({
  exists: () => daten !== undefined,
  data: () => daten,
  metadata: { fromCache: false },
});

describe('FirestoreAuswahl', () => {
  const oeffnen = () => new FirestoreAuswahl({} as Firestore, 'uid-1');

  it('shows nothing and takes no change once its listener failed after a read', async () => {
    const auswahl = oeffnen();
    listener.weiter?.(stand({ version: 3, teams: { 313036: 1 } }));
    expect(auswahl.teams()).toEqual([313036]);

    listener.fehler?.({ code: 'unavailable' });

    expect(auswahl.nichtLesbar()).toBe(true);
    expect(auswahl.teams()).toBeUndefined();
    expect(auswahl.kinder()).toBeUndefined();
    await expect(auswahl.folgen(201500)).rejects.toThrow();
  });

  it('ends a change waiting for the first read once it is ended', async () => {
    const auswahl = oeffnen();
    const gefolgt = auswahl.folgen(201500);

    auswahl.beenden();

    await expect(gefolgt).rejects.toThrow();
    await expect(auswahl.geladen()).rejects.toThrow();
  });
});
