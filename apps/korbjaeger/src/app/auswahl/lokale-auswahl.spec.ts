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

    expect(auswahl.teams()).toEqual([313036]);
  });

  it('follows for this visit where the device has no storage', async () => {
    const auswahl = new LokaleAuswahl(undefined);

    await auswahl.folgen(313036);

    expect(auswahl.teams()).toEqual([313036]);
  });
});
