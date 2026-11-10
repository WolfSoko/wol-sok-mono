import {
  ANTWORT_INDEX,
  ANTWORT_PRAEFIX,
  LokaleLetzteAntworten,
  MAX_ALTER_MS,
  type AntwortSpeicher,
  type LetzteAntwort,
} from './letzte-antworten';

/** A key the app keeps beside the answers (Meine Teams); the store never touches it. */
const ANDERER_SCHLUESSEL = 'meine-teams';

/** A `localStorage` that takes at most `zeichen` characters, keys and values. */
class KleinerSpeicher implements AntwortSpeicher {
  public readonly eintraege = new Map<string, string>();

  public constructor(private readonly zeichen = Number.POSITIVE_INFINITY) {}

  public get length(): number {
    return this.eintraege.size;
  }

  public key(index: number): string | null {
    return [...this.eintraege.keys()][index] ?? null;
  }

  public getItem(key: string): string | null {
    return this.eintraege.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    const ohne = [...this.eintraege].filter(([k]) => k !== key);
    const belegt = ohne.reduce((sum, [k, v]) => sum + k.length + v.length, 0);
    if (belegt + key.length + value.length > this.zeichen) {
      throw new DOMException(
        'The quota has been exceeded.',
        'QuotaExceededError'
      );
    }
    this.eintraege.set(key, value);
  }

  public removeItem(key: string): void {
    this.eintraege.delete(key);
  }
}

const TEAM = '/api/dbb/team/313036/spiele';
const TABELLE = '/api/dbb/liga/54862/tabelle';
const SPIEL = '/api/dbb/spiel/2861436';

/** When the specs read: shortly after every answer they store. */
const JETZT = 10_000;
const MINUTE = 60_000;

function antwort(
  gespeichertAm: number,
  daten: unknown = { status: '0' }
): LetzteAntwort {
  return { antwort: daten, gespeichertAm };
}

/** The paths `antworten` still has a last good answer for. */
function gemerkt(
  antworten: LokaleLetzteAntworten,
  pfade: readonly string[]
): string[] {
  return pfade.filter((pfad) => antworten.lesen(pfad, JETZT) !== undefined);
}

describe('LokaleLetzteAntworten', () => {
  it('gives back the last good answer of a path, with when it was stored', () => {
    const antworten = new LokaleLetzteAntworten(new KleinerSpeicher());

    antworten.merken(TEAM, 'team-games', antwort(1000, { data: [1] }));
    antworten.merken(TEAM, 'team-games', antwort(2000, { data: [2] }));

    expect(antworten.lesen(TEAM, JETZT)).toEqual(antwort(2000, { data: [2] }));
    expect(antworten.lesen(TABELLE, JETZT)).toBeUndefined();
  });

  it('keeps them across visits, in the device storage', () => {
    const speicher = new KleinerSpeicher();
    new LokaleLetzteAntworten(speicher).merken(
      TEAM,
      'team-games',
      antwort(1000)
    );

    expect(new LokaleLetzteAntworten(speicher).lesen(TEAM, JETZT)).toEqual(
      antwort(1000)
    );
  });

  describe('age', () => {
    it('serves an answer up to seven days old', () => {
      const antworten = new LokaleLetzteAntworten(new KleinerSpeicher());
      antworten.merken(TEAM, 'team-games', antwort(0));

      expect(antworten.lesen(TEAM, MAX_ALTER_MS)).toEqual(antwort(0));
      expect(MAX_ALTER_MS).toBe(7 * 24 * 60 * MINUTE);
    });

    it('serves no answer seven days and a minute old, and deletes it', () => {
      const speicher = new KleinerSpeicher();
      const antworten = new LokaleLetzteAntworten(speicher);
      antworten.merken(TEAM, 'team-games', antwort(0));

      expect(antworten.lesen(TEAM, MAX_ALTER_MS + MINUTE)).toBeUndefined();
      expect(speicher.getItem(`${ANTWORT_PRAEFIX}${TEAM}`)).toBeNull();
    });

    it('clears answers too old, of kinds no longer kept and of older versions', () => {
      const speicher = new KleinerSpeicher();
      const antworten = new LokaleLetzteAntworten(speicher);
      antworten.merken(TEAM, 'team-games', antwort(0));
      antworten.merken(TABELLE, 'standings', antwort(MAX_ALTER_MS));
      antworten.merken(SPIEL, 'game-report', antwort(MAX_ALTER_MS));
      speicher.setItem(
        `${ANTWORT_PRAEFIX}/api/dbb/liga/1/tabelle`,
        JSON.stringify({ v: 1, am: MAX_ALTER_MS, antwort: {} })
      );

      antworten.aufraeumen(MAX_ALTER_MS + MINUTE, new Set(['standings']));

      expect(
        [...speicher.eintraege.keys()].filter((key) =>
          key.startsWith(ANTWORT_PRAEFIX)
        )
      ).toEqual([`${ANTWORT_PRAEFIX}${TABELLE}`]);
    });
  });

  describe('limits', () => {
    it('evicts the oldest answers once it holds as many as it may', () => {
      const antworten = new LokaleLetzteAntworten(new KleinerSpeicher(), {
        eintraege: 2,
      });

      antworten.merken(TABELLE, 'standings', antwort(2000));
      antworten.merken(TEAM, 'team-games', antwort(1000));
      antworten.merken(SPIEL, 'game-info', antwort(3000));

      expect(gemerkt(antworten, [TEAM, TABELLE, SPIEL])).toEqual([
        TABELLE,
        SPIEL,
      ]);
    });

    it('counts a path stored again once', () => {
      const antworten = new LokaleLetzteAntworten(new KleinerSpeicher(), {
        eintraege: 2,
      });

      antworten.merken(TEAM, 'team-games', antwort(1000));
      antworten.merken(TABELLE, 'standings', antwort(2000));
      antworten.merken(TEAM, 'team-games', antwort(3000));

      expect(gemerkt(antworten, [TEAM, TABELLE])).toEqual([TEAM, TABELLE]);
    });

    it('evicts the oldest answers once they hold more characters than they may', () => {
      const antworten = new LokaleLetzteAntworten(new KleinerSpeicher(), {
        zeichen: 250,
      });
      const gross = { data: 'x'.repeat(100) };

      antworten.merken(TEAM, 'team-games', antwort(1000, gross));
      antworten.merken(TABELLE, 'standings', antwort(2000, gross));

      expect(gemerkt(antworten, [TEAM, TABELLE])).toEqual([TABELLE]);
    });

    it('keeps no answer larger than all of them may be, and drops the older one of its path', () => {
      const antworten = new LokaleLetzteAntworten(new KleinerSpeicher(), {
        zeichen: 250,
      });
      antworten.merken(TABELLE, 'standings', antwort(1000));
      antworten.merken(TEAM, 'team-games', antwort(1500));

      antworten.merken(
        TEAM,
        'team-games',
        antwort(2000, { data: 'x'.repeat(300) })
      );

      expect(gemerkt(antworten, [TEAM, TABELLE])).toEqual([TABELLE]);
    });

    it('makes room in a full storage by evicting its oldest answers', () => {
      const antworten = new LokaleLetzteAntworten(new KleinerSpeicher(2600));
      const daten = { data: 'x'.repeat(1000) };

      antworten.merken(TEAM, 'team-games', antwort(1000, daten));
      antworten.merken(TABELLE, 'standings', antwort(2000, daten));
      antworten.merken(SPIEL, 'game-info', antwort(3000, daten));

      expect(gemerkt(antworten, [TEAM, TABELLE, SPIEL])).toEqual([
        TABELLE,
        SPIEL,
      ]);
    });

    it('never evicts what the app keeps beside them, and gives up when that fills the storage', () => {
      const speicher = new KleinerSpeicher(120);
      speicher.setItem(ANDERER_SCHLUESSEL, 'x'.repeat(100));
      const antworten = new LokaleLetzteAntworten(speicher);

      expect(() =>
        antworten.merken(TEAM, 'team-games', antwort(1000))
      ).not.toThrow();

      expect(antworten.lesen(TEAM, JETZT)).toBeUndefined();
      expect(speicher.getItem(ANDERER_SCHLUESSEL)).toHaveLength(100);
    });

    it('drops the older answer of a path whose new one the full storage does not take', () => {
      const speicher = new KleinerSpeicher(700);
      speicher.setItem(ANDERER_SCHLUESSEL, 'x'.repeat(400));
      const antworten = new LokaleLetzteAntworten(speicher);
      antworten.merken(TEAM, 'team-games', antwort(1000));
      expect(antworten.lesen(TEAM, JETZT)).toBeDefined();

      antworten.merken(
        TEAM,
        'team-games',
        antwort(2000, { data: 'x'.repeat(300) })
      );

      expect(antworten.lesen(TEAM, JETZT)).toBeUndefined();
    });

    it('evicts nothing for a storage that refuses writes for another reason', () => {
      const speicher = new KleinerSpeicher();
      const antworten = new LokaleLetzteAntworten(speicher);
      antworten.merken(TABELLE, 'standings', antwort(1000));
      vi.spyOn(speicher, 'setItem').mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });

      antworten.merken(TEAM, 'team-games', antwort(2000));

      expect(gemerkt(antworten, [TEAM, TABELLE])).toEqual([TABELLE]);
    });
  });

  it('evicts nothing for a write the storage refuses for another reason, even at its limit', () => {
    const speicher = new KleinerSpeicher();
    const antworten = new LokaleLetzteAntworten(speicher, { eintraege: 2 });
    antworten.merken(TEAM, 'team-games', antwort(1000));
    antworten.merken(TABELLE, 'standings', antwort(2000));
    const schreiben = speicher.setItem.bind(speicher);
    vi.spyOn(speicher, 'setItem').mockImplementation((key, value) => {
      if (key === `${ANTWORT_PRAEFIX}${SPIEL}`) {
        throw new DOMException('denied', 'SecurityError');
      }
      schreiben(key, value);
    });

    antworten.merken(SPIEL, 'game-info', antwort(3000));

    expect(gemerkt(antworten, [TEAM, TABELLE, SPIEL])).toEqual([TEAM, TABELLE]);
  });

  it('gives all its room away for what must not give way (Meine Teams)', () => {
    const speicher = new KleinerSpeicher();
    speicher.setItem(ANDERER_SCHLUESSEL, '{}');
    const antworten = new LokaleLetzteAntworten(speicher);
    antworten.merken(TEAM, 'team-games', antwort(1000));
    antworten.merken(TABELLE, 'standings', antwort(2000));

    antworten.leeren();

    expect([...speicher.eintraege.keys()]).toEqual([ANDERER_SCHLUESSEL]);
    expect(gemerkt(antworten, [TEAM, TABELLE])).toEqual([]);
    antworten.merken(SPIEL, 'game-info', antwort(3000));
    expect(gemerkt(antworten, [SPIEL])).toEqual([SPIEL]);
  });

  describe('its index', () => {
    it('parses the stored index once for writes in a row', () => {
      const speicher = new KleinerSpeicher();
      new LokaleLetzteAntworten(speicher).merken(
        TEAM,
        'team-games',
        antwort(1000)
      );
      const antworten = new LokaleLetzteAntworten(speicher);
      const geparst = vi.spyOn(JSON, 'parse');

      antworten.merken(TABELLE, 'standings', antwort(2000));
      antworten.merken(SPIEL, 'game-info', antwort(3000));

      expect(geparst).toHaveBeenCalledTimes(1);
    });

    it('reads the index again once another tab changed it', () => {
      const speicher = new KleinerSpeicher();
      const hier = new LokaleLetzteAntworten(speicher, { eintraege: 2 });
      const dort = new LokaleLetzteAntworten(speicher, { eintraege: 2 });
      hier.merken(TEAM, 'team-games', antwort(1000));
      dort.merken(TABELLE, 'standings', antwort(2000));

      hier.merken(SPIEL, 'game-info', antwort(3000));

      expect(gemerkt(hier, [TEAM, TABELLE, SPIEL])).toEqual([TABELLE, SPIEL]);
    });

    it('reads no stored answer for a write within the limits', () => {
      const speicher = new KleinerSpeicher();
      const antworten = new LokaleLetzteAntworten(speicher);
      antworten.merken(TEAM, 'team-games', antwort(1000));
      const gelesen = vi.spyOn(speicher, 'getItem');

      antworten.merken(TABELLE, 'standings', antwort(2000));
      antworten.merken(SPIEL, 'game-info', antwort(3000));

      expect(
        gelesen.mock.calls.filter(([key]) => key !== ANTWORT_INDEX)
      ).toEqual([]);
    });

    it('counts no answer deleted behind its back', () => {
      const speicher = new KleinerSpeicher();
      const antworten = new LokaleLetzteAntworten(speicher, { eintraege: 2 });
      antworten.merken(TEAM, 'team-games', antwort(1000));
      antworten.merken(TABELLE, 'standings', antwort(2000));
      speicher.removeItem(`${ANTWORT_PRAEFIX}${TEAM}`);

      antworten.merken(SPIEL, 'game-info', antwort(3000));

      expect(gemerkt(antworten, [TABELLE, SPIEL])).toEqual([TABELLE, SPIEL]);
    });

    it('rebuilds itself from the answers when it cannot be read', () => {
      const speicher = new KleinerSpeicher();
      const antworten = new LokaleLetzteAntworten(speicher, { eintraege: 2 });
      antworten.merken(TABELLE, 'standings', antwort(2000));
      antworten.merken(TEAM, 'team-games', antwort(1000));
      speicher.setItem(ANTWORT_INDEX, '{kaputt');

      antworten.merken(SPIEL, 'game-info', antwort(3000));

      expect(gemerkt(antworten, [TEAM, TABELLE, SPIEL])).toEqual([
        TABELLE,
        SPIEL,
      ]);
    });

    it('evicts an answer it cannot read first', () => {
      const speicher = new KleinerSpeicher();
      const antworten = new LokaleLetzteAntworten(speicher, { eintraege: 2 });
      antworten.merken(TABELLE, 'standings', antwort(1000));
      speicher.setItem(`${ANTWORT_PRAEFIX}${TEAM}`, '{kaputt');

      antworten.merken(SPIEL, 'game-info', antwort(2000));

      expect(antworten.lesen(TEAM, JETZT)).toBeUndefined();
      expect(gemerkt(antworten, [TABELLE, SPIEL])).toEqual([TABELLE, SPIEL]);
    });
  });

  it.each([
    ['of another version', { v: 1, am: 1000, antwort: {} }],
    ['without its time', { v: 2, art: 'tabelle', antwort: {} }],
    ['at no valid time', { v: 2, am: 1e20, art: 'tabelle', antwort: {} }],
  ])('reads a stored answer %s as none', (_fall, gespeichert) => {
    const speicher = new KleinerSpeicher();
    speicher.setItem(`${ANTWORT_PRAEFIX}${TEAM}`, JSON.stringify(gespeichert));

    expect(
      new LokaleLetzteAntworten(speicher).lesen(TEAM, JETZT)
    ).toBeUndefined();
  });

  describe('the stored kinds', () => {
    it('stores each kind under its name before #2967', () => {
      const speicher = new KleinerSpeicher();
      new LokaleLetzteAntworten(speicher).merken(
        TEAM,
        'team-games',
        antwort(1000)
      );

      expect(
        JSON.parse(speicher.getItem(`${ANTWORT_PRAEFIX}${TEAM}`) ?? '{}')
      ).toMatchObject({ art: 'team-spiele' });
      expect(speicher.getItem(ANTWORT_INDEX)).toContain('"art":"team-spiele"');
    });

    it('serves and keeps an answer stored before #2967', () => {
      const speicher = new KleinerSpeicher();
      speicher.setItem(
        `${ANTWORT_PRAEFIX}${TEAM}`,
        JSON.stringify({ v: 2, am: 1000, art: 'team-spiele', antwort: {} })
      );
      const antworten = new LokaleLetzteAntworten(speicher);

      antworten.aufraeumen(JETZT, new Set(['team-games']));

      expect(antworten.lesen(TEAM, JETZT)).toEqual(antwort(1000, {}));
    });
  });

  it('keeps nothing, and fails nothing, without a storage', () => {
    const antworten = new LokaleLetzteAntworten(undefined);

    antworten.merken(TEAM, 'team-games', antwort(1000));
    antworten.aufraeumen(JETZT, new Set());

    expect(antworten.lesen(TEAM, JETZT)).toBeUndefined();
  });

  it('fails nothing where the storage throws on every access', () => {
    const blockiert = (): never => {
      throw new DOMException('blocked', 'SecurityError');
    };
    const speicher: AntwortSpeicher = {
      get length(): number {
        return blockiert();
      },
      key: blockiert,
      getItem: blockiert,
      setItem: blockiert,
      removeItem: blockiert,
    };
    const antworten = new LokaleLetzteAntworten(speicher);

    expect(() => {
      antworten.merken(TEAM, 'team-games', antwort(1000));
      antworten.aufraeumen(JETZT, new Set());
    }).not.toThrow();
    expect(antworten.lesen(TEAM, JETZT)).toBeUndefined();
  });
});
