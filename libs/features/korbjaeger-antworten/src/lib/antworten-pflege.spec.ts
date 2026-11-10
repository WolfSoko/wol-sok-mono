import type { DbbRequestKind } from '@wolsok/feat-shared-basketball-data';
import { antwortenPflegen, PFLEGE_TAKT_MS } from './antworten-pflege';

const ARTEN: ReadonlySet<DbbRequestKind> = new Set(['team-games']);
const START = Date.parse('2026-11-08T12:00:00+01:00');
const MINUTE = 60_000;

/** A page whose visibility a spec sets. */
class Seite extends EventTarget {
  public visibilityState: DocumentVisibilityState = 'visible';

  public werden(zustand: DocumentVisibilityState): void {
    this.visibilityState = zustand;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

describe('antwortenPflegen', () => {
  let seite: Seite;
  let laeufe: { jetzt: number; arten: ReadonlySet<string> }[];
  let stoppen: () => void;

  const antworten = {
    aufraeumen: (jetzt: number, arten: ReadonlySet<string>): void => {
      laeufe.push({ jetzt, arten });
    },
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(START);
    seite = new Seite();
    laeufe = [];
    stoppen = antwortenPflegen(antworten, { document: seite, arten: ARTEN });
  });

  afterEach(() => {
    stoppen();
    vi.useRealTimers();
  });

  it('clears at once, with the kinds kept and the time now', () => {
    expect(laeufe).toEqual([{ jetzt: START, arten: ARTEN }]);
  });

  it('clears whenever the page comes back into view', () => {
    seite.werden('hidden');
    vi.setSystemTime(START + MINUTE);

    seite.werden('visible');

    expect(laeufe.map(({ jetzt }) => jetzt)).toEqual([START, START + MINUTE]);
  });

  it('does not clear while the page is hidden', () => {
    seite.werden('hidden');

    expect(laeufe).toHaveLength(1);
  });

  it('clears hourly while the page stays open', () => {
    vi.advanceTimersByTime(PFLEGE_TAKT_MS - MINUTE);
    expect(laeufe).toHaveLength(1);

    vi.advanceTimersByTime(MINUTE);

    expect(laeufe).toHaveLength(2);
  });

  it('clears nothing once stopped', () => {
    stoppen();

    seite.werden('hidden');
    seite.werden('visible');
    vi.advanceTimersByTime(PFLEGE_TAKT_MS);

    expect(laeufe).toHaveLength(1);
  });
});
