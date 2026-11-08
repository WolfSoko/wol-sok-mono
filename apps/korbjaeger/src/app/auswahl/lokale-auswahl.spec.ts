import { AuswahlZuNeuError } from './auswahl-fehler';
import { AUSWAHL_SCHLUESSEL, LokaleAuswahl } from './lokale-auswahl';
import { auswahlVertrag } from './testing/auswahl-vertrag';

/** The device's storage, as the adapter uses it, in memory. */
class SpeicherImSpec {
  private readonly eintraege = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.eintraege.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.eintraege.set(key, value);
  }

  public removeItem(key: string): void {
    this.eintraege.delete(key);
  }
}

/** What a browser tells the other tabs once one changed `key`. */
function geaendert(key: string | null): StorageEvent {
  return new StorageEvent('storage', { key });
}

function gespeichert(geraet: SpeicherImSpec): unknown {
  return JSON.parse(geraet.getItem(AUSWAHL_SCHLUESSEL) ?? 'null');
}

auswahlVertrag('local', () => {
  const geraet = new SpeicherImSpec();
  return {
    oeffnen: async () => new LokaleAuswahl(geraet),
    verderben: async () => geraet.setItem(AUSWAHL_SCHLUESSEL, '{"teams": [31'),
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

  it.each([
    ['another version', { version: 2, teams: [313036] }],
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

  it('keeps fields it does not know, which a later version wrote', async () => {
    const geraet = new SpeicherImSpec();
    const kinder = [{ personId: 4711, spitzname: 'Mia' }];
    geraet.setItem(
      AUSWAHL_SCHLUESSEL,
      JSON.stringify({ version: 1, teams: [201500], kinder })
    );

    await new LokaleAuswahl(geraet).folgen(313036);

    expect(gespeichert(geraet)).toEqual({
      version: 1,
      teams: [201500, 313036],
      kinder,
    });
  });

  describe('a document of a newer version', () => {
    const NEUER = JSON.stringify({ version: 2, teams: [201500], mehr: true });

    function geraetMitNeuerem(): SpeicherImSpec {
      const geraet = new SpeicherImSpec();
      geraet.setItem(AUSWAHL_SCHLUESSEL, NEUER);
      return geraet;
    }

    it('follows no Team from it', () => {
      expect(new LokaleAuswahl(geraetMitNeuerem()).teams()).toEqual([]);
    });

    it('refuses to follow or unfollow, and leaves the document alone', async () => {
      const geraet = geraetMitNeuerem();
      const auswahl = new LokaleAuswahl(geraet);

      await expect(auswahl.folgen(313036)).rejects.toBeInstanceOf(
        AuswahlZuNeuError
      );
      await expect(auswahl.entfolgen(201500)).rejects.toBeInstanceOf(
        AuswahlZuNeuError
      );

      expect(geraet.getItem(AUSWAHL_SCHLUESSEL)).toBe(NEUER);
      expect(auswahl.teams()).toEqual([]);
    });

    it('refuses once another tab wrote one since it opened', async () => {
      const geraet = new SpeicherImSpec();
      const auswahl = new LokaleAuswahl(geraet);
      geraet.setItem(AUSWAHL_SCHLUESSEL, NEUER);

      await expect(auswahl.folgen(313036)).rejects.toBeInstanceOf(
        AuswahlZuNeuError
      );
      expect(geraet.getItem(AUSWAHL_SCHLUESSEL)).toBe(NEUER);
    });
  });

  describe('two tabs on one storage', () => {
    it("shows the other tab's follow once the browser tells of it", async () => {
      const geraet = new SpeicherImSpec();
      const fensterA = new EventTarget();
      const tabA = new LokaleAuswahl(geraet, fensterA);
      const tabB = new LokaleAuswahl(geraet, new EventTarget());

      await tabB.folgen(313036);
      fensterA.dispatchEvent(geaendert(AUSWAHL_SCHLUESSEL));

      expect(tabA.teams()).toEqual([313036]);
    });

    it('shows no Team once the storage was cleared', async () => {
      const geraet = new SpeicherImSpec();
      const fenster = new EventTarget();
      const auswahl = new LokaleAuswahl(geraet, fenster);
      await auswahl.folgen(313036);

      geraet.removeItem(AUSWAHL_SCHLUESSEL);
      fenster.dispatchEvent(geaendert(null));

      expect(auswahl.teams()).toEqual([]);
    });

    it('passes over changes to other keys', async () => {
      const geraet = new SpeicherImSpec();
      const fenster = new EventTarget();
      const auswahl = new LokaleAuswahl(geraet, fenster);
      await auswahl.folgen(313036);
      const vorher = auswahl.teams();

      fenster.dispatchEvent(geaendert('etwas-anderes'));

      expect(auswahl.teams()).toBe(vorher);
    });

    it('listens no longer once ended', async () => {
      const geraet = new SpeicherImSpec();
      const fensterA = new EventTarget();
      const tabA = new LokaleAuswahl(geraet, fensterA);
      const tabB = new LokaleAuswahl(geraet, new EventTarget());

      tabA.beenden();
      await tabB.folgen(313036);
      fensterA.dispatchEvent(geaendert(AUSWAHL_SCHLUESSEL));

      expect(tabA.teams()).toEqual([]);
    });

    it("keeps the other tab's follow in its own, without being told", async () => {
      const geraet = new SpeicherImSpec();
      const tabA = new LokaleAuswahl(geraet);
      const tabB = new LokaleAuswahl(geraet);

      await tabA.folgen(313036);
      await tabB.folgen(201500);

      expect(tabB.teams()).toEqual([313036, 201500]);
      expect(gespeichert(geraet)).toEqual({
        version: 1,
        teams: [313036, 201500],
      });
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
