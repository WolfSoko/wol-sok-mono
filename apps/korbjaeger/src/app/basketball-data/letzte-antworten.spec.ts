import {
  LokaleLetzteAntworten,
  type AntwortSpeicher,
  type LetzteAntwort,
} from './letzte-antworten';

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
  return pfade.filter((pfad) => antworten.lesen(pfad) !== undefined);
}

describe('LokaleLetzteAntworten', () => {
  it('gives back the last good answer of a path, with when it was stored', () => {
    const antworten = new LokaleLetzteAntworten(new KleinerSpeicher());

    antworten.merken(TEAM, antwort(1000, { status: '0', data: [1] }));
    antworten.merken(TEAM, antwort(2000, { status: '0', data: [2] }));

    expect(antworten.lesen(TEAM)).toEqual(
      antwort(2000, { status: '0', data: [2] })
    );
    expect(antworten.lesen(TABELLE)).toBeUndefined();
  });

  it('keeps them across visits, in the device storage', () => {
    const speicher = new KleinerSpeicher();
    new LokaleLetzteAntworten(speicher).merken(TEAM, antwort(1000));

    expect(new LokaleLetzteAntworten(speicher).lesen(TEAM)).toEqual(
      antwort(1000)
    );
  });

  it('evicts the oldest answers once it holds as many as it may', () => {
    const antworten = new LokaleLetzteAntworten(new KleinerSpeicher(), {
      eintraege: 2,
    });

    antworten.merken(TABELLE, antwort(2000));
    antworten.merken(TEAM, antwort(1000));
    antworten.merken(SPIEL, antwort(3000));

    expect(gemerkt(antworten, [TEAM, TABELLE, SPIEL])).toEqual([
      TABELLE,
      SPIEL,
    ]);
  });

  it('counts a path stored again once', () => {
    const antworten = new LokaleLetzteAntworten(new KleinerSpeicher(), {
      eintraege: 2,
    });

    antworten.merken(TEAM, antwort(1000));
    antworten.merken(TABELLE, antwort(2000));
    antworten.merken(TEAM, antwort(3000));

    expect(gemerkt(antworten, [TEAM, TABELLE])).toEqual([TEAM, TABELLE]);
  });

  it('evicts the oldest answers once they hold more characters than they may', () => {
    const antworten = new LokaleLetzteAntworten(new KleinerSpeicher(), {
      zeichen: 250,
    });
    const gross = { status: '0', data: 'x'.repeat(100) };

    antworten.merken(TEAM, antwort(1000, gross));
    antworten.merken(TABELLE, antwort(2000, gross));

    expect(gemerkt(antworten, [TEAM, TABELLE])).toEqual([TABELLE]);
  });

  it('keeps no answer larger than all of them may be', () => {
    const antworten = new LokaleLetzteAntworten(new KleinerSpeicher(), {
      zeichen: 150,
    });
    antworten.merken(TABELLE, antwort(1000));

    antworten.merken(TEAM, antwort(2000, { data: 'x'.repeat(100) }));

    expect(gemerkt(antworten, [TEAM, TABELLE])).toEqual([TABELLE]);
  });

  it('makes room in a full storage by evicting its oldest answers', () => {
    const speicher = new KleinerSpeicher(300);
    const antworten = new LokaleLetzteAntworten(speicher);
    const daten = { status: '0', data: 'x'.repeat(40) };

    antworten.merken(TEAM, antwort(1000, daten));
    antworten.merken(TABELLE, antwort(2000, daten));
    antworten.merken(SPIEL, antwort(3000, daten));

    expect(gemerkt(antworten, [TEAM, TABELLE, SPIEL])).toEqual([
      TABELLE,
      SPIEL,
    ]);
  });

  it('never evicts what the app keeps beside them, and gives up when that fills the storage', () => {
    const speicher = new KleinerSpeicher(120);
    speicher.setItem('korbjaeger-auswahl', 'x'.repeat(100));
    const antworten = new LokaleLetzteAntworten(speicher);

    expect(() => antworten.merken(TEAM, antwort(1000))).not.toThrow();

    expect(antworten.lesen(TEAM)).toBeUndefined();
    expect(speicher.getItem('korbjaeger-auswahl')).toHaveLength(100);
  });

  it('evicts nothing for a storage that refuses writes for another reason', () => {
    const speicher = new KleinerSpeicher();
    const antworten = new LokaleLetzteAntworten(speicher);
    antworten.merken(TABELLE, antwort(1000));
    vi.spyOn(speicher, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    antworten.merken(TEAM, antwort(2000));

    expect(gemerkt(antworten, [TEAM, TABELLE])).toEqual([TABELLE]);
  });

  it('reads a stored answer it cannot read as none, and evicts it first', () => {
    const speicher = new KleinerSpeicher();
    const antworten = new LokaleLetzteAntworten(speicher, { eintraege: 2 });
    antworten.merken(TABELLE, antwort(1000));
    speicher.setItem(`korbjaeger-antwort:${TEAM}`, '{kaputt');

    antworten.merken(SPIEL, antwort(2000));

    expect(antworten.lesen(TEAM)).toBeUndefined();
    expect(gemerkt(antworten, [TABELLE, SPIEL])).toEqual([TABELLE, SPIEL]);
  });

  it.each([
    ['of another version', { v: 2, am: 1000, antwort: {} }],
    ['without its time', { v: 1, antwort: {} }],
  ])('reads a stored answer %s as none', (_fall, gespeichert) => {
    const speicher = new KleinerSpeicher();
    speicher.setItem(`korbjaeger-antwort:${TEAM}`, JSON.stringify(gespeichert));

    expect(new LokaleLetzteAntworten(speicher).lesen(TEAM)).toBeUndefined();
  });

  it('keeps nothing, and fails nothing, without a storage', () => {
    const antworten = new LokaleLetzteAntworten(undefined);

    antworten.merken(TEAM, antwort(1000));

    expect(antworten.lesen(TEAM)).toBeUndefined();
  });

  it('fails nothing where the storage throws on every access', () => {
    const blockiert: AntwortSpeicher = {
      get length(): number {
        throw new DOMException('blocked', 'SecurityError');
      },
      key: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      removeItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    };
    const antworten = new LokaleLetzteAntworten(blockiert);

    expect(() => antworten.merken(TEAM, antwort(1000))).not.toThrow();
    expect(antworten.lesen(TEAM)).toBeUndefined();
  });
});
