import { AUSWAHL_SCHLUESSEL, LokaleAuswahl } from './lokale-auswahl';
import { auswahlVertrag } from './testing/auswahl-vertrag';

/**
 * The device's storage, as the adapter uses it, in memory. Like a browser
 * it tells the tabs on `fenster` of every write; this one tells the
 * writing tab too, which reads what it wrote again.
 */
class SpeicherImSpec {
  public readonly fenster = new EventTarget();
  public schreibvorgaenge = 0;
  private readonly eintraege = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.eintraege.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.schreibvorgaenge++;
    this.setzeLeise(key, value);
    this.fenster.dispatchEvent(new StorageEvent('storage', { key }));
  }

  /** Stores `value` without telling any tab. */
  public setzeLeise(key: string, value: string): void {
    this.eintraege.set(key, value);
  }

  public removeItem(key: string): void {
    this.eintraege.delete(key);
    this.fenster.dispatchEvent(new StorageEvent('storage', { key }));
  }
}

auswahlVertrag('local', () => {
  const geraet = new SpeicherImSpec();
  return {
    oeffnen: async () => new LokaleAuswahl(geraet, geraet.fenster),
    schreibeRoh: async (dokument) =>
      geraet.setItem(AUSWAHL_SCHLUESSEL, JSON.stringify(dokument)),
    liesRoh: async () =>
      JSON.parse(geraet.getItem(AUSWAHL_SCHLUESSEL) ?? 'null'),
    bisStabil: async () => undefined,
  };
});

describe('LokaleAuswahl', () => {
  it('stores a versioned document, which Kinder can join later', async () => {
    const geraet = new SpeicherImSpec();

    await new LokaleAuswahl(geraet).folgen(313036);

    expect(JSON.parse(geraet.getItem(AUSWAHL_SCHLUESSEL) ?? '')).toEqual({
      version: 1,
      teams: [313036],
    });
  });

  it('starts empty from storage that holds no JSON', () => {
    const geraet = new SpeicherImSpec();
    geraet.setItem(AUSWAHL_SCHLUESSEL, '{"teams": [31');

    expect(new LokaleAuswahl(geraet).teams()).toEqual([]);
  });

  it.each([
    ['another version', { version: 0, teams: [313036] }],
    ['no version', { teams: [313036] }],
    ['no list of Teams', { version: 1, teams: 313036 }],
    ['a Team that is no DBB id', { version: 1, teams: [313036, '201500'] }],
    ['a negative Team id', { version: 1, teams: [-1] }],
    ['no object', [313036]],
    ['null', null],
  ])('ignores a stored document with %s', (_fall, dokument) => {
    const geraet = new SpeicherImSpec();
    geraet.setItem(AUSWAHL_SCHLUESSEL, JSON.stringify(dokument));

    expect(new LokaleAuswahl(geraet).teams()).toEqual([]);
  });

  it('writes nothing to unfollow a Team it does not follow', async () => {
    const geraet = new SpeicherImSpec();
    const auswahl = new LokaleAuswahl(geraet);
    await auswahl.folgen(313036);
    const vorher = geraet.schreibvorgaenge;

    await auswahl.entfolgen(201500);

    expect(geraet.schreibvorgaenge).toBe(vorher);
  });

  describe('two tabs on one storage', () => {
    it('shows no Team once the storage was cleared', async () => {
      const geraet = new SpeicherImSpec();
      const auswahl = new LokaleAuswahl(geraet, geraet.fenster);
      await auswahl.folgen(313036);

      geraet.removeItem(AUSWAHL_SCHLUESSEL);

      expect(auswahl.teams()).toEqual([]);
    });

    it('keeps its Teams as they are where another tab stored the same', async () => {
      const geraet = new SpeicherImSpec();
      const tabA = new LokaleAuswahl(geraet, geraet.fenster);
      await tabA.folgen(313036);
      const vorher = tabA.teams();

      geraet.setItem(
        AUSWAHL_SCHLUESSEL,
        JSON.stringify({ version: 1, teams: [313036], mehr: 1 })
      );

      expect(tabA.teams()).toBe(vorher);
    });

    it('passes over changes to other keys', async () => {
      const geraet = new SpeicherImSpec();
      const auswahl = new LokaleAuswahl(geraet, geraet.fenster);
      await auswahl.folgen(313036);
      geraet.setzeLeise(
        AUSWAHL_SCHLUESSEL,
        JSON.stringify({ version: 1, teams: [201500] })
      );

      geraet.fenster.dispatchEvent(
        new StorageEvent('storage', { key: 'etwas-anderes' })
      );
      expect(auswahl.teams()).toEqual([313036]);

      geraet.fenster.dispatchEvent(
        new StorageEvent('storage', { key: AUSWAHL_SCHLUESSEL })
      );
      expect(auswahl.teams()).toEqual([201500]);
    });

    it('listens no longer once ended', async () => {
      const geraet = new SpeicherImSpec();
      const tabA = new LokaleAuswahl(geraet, geraet.fenster);
      const tabB = new LokaleAuswahl(geraet);

      tabA.beenden();
      await tabB.folgen(313036);

      expect(tabA.teams()).toEqual([]);
    });
  });

  it('follows no Team where the storage cannot be read', () => {
    const auswahl = new LokaleAuswahl({
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      setItem: () => undefined,
    });

    expect(auswahl.teams()).toEqual([]);
  });

  it('still follows where the storage takes nothing, for this visit', async () => {
    const auswahl = new LokaleAuswahl({
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    });

    await auswahl.folgen(313036);
    await auswahl.folgen(201500);

    expect(auswahl.teams()).toEqual([313036, 201500]);
  });

  it('follows for this visit where the device has no storage', async () => {
    const auswahl = new LokaleAuswahl(undefined);

    await auswahl.folgen(313036);
    await auswahl.folgen(201500);

    expect(auswahl.teams()).toEqual([313036, 201500]);
  });
});
