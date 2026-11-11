import type { DbbRequestKind } from '@wolsok/feat-shared-basketball-data';
import {
  maintainAnswerCache,
  MAINTENANCE_INTERVAL_MS,
} from './answer-cache-maintenance';

const KINDS: ReadonlySet<DbbRequestKind> = new Set(['team-games']);
const START = Date.parse('2026-11-08T12:00:00+01:00');
const MINUTE = 60_000;

/** A page whose visibility a spec sets. */
class FakePage extends EventTarget {
  public visibilityState: DocumentVisibilityState = 'visible';

  public become(state: DocumentVisibilityState): void {
    this.visibilityState = state;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

describe('maintainAnswerCache', () => {
  let page: FakePage;
  let runs: { now: number; kinds: ReadonlySet<string> }[];
  let stopMaintenance: () => void;

  const cache = {
    cleanUp: (now: number, kinds: ReadonlySet<string>): void => {
      runs.push({ now, kinds });
    },
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(START);
    page = new FakePage();
    runs = [];
    stopMaintenance = maintainAnswerCache(cache, {
      document: page,
      kinds: KINDS,
    });
  });

  afterEach(() => {
    stopMaintenance();
    vi.useRealTimers();
  });

  it('clears at once, with the kinds kept and the time now', () => {
    expect(runs).toEqual([{ now: START, kinds: KINDS }]);
  });

  it('clears whenever the page comes back into view', () => {
    page.become('hidden');
    vi.setSystemTime(START + MINUTE);

    page.become('visible');

    expect(runs.map(({ now }) => now)).toEqual([START, START + MINUTE]);
  });

  it('does not clear while the page is hidden', () => {
    page.become('hidden');

    expect(runs).toHaveLength(1);
  });

  it('clears hourly while the page stays open', () => {
    vi.advanceTimersByTime(MAINTENANCE_INTERVAL_MS - MINUTE);
    expect(runs).toHaveLength(1);

    vi.advanceTimersByTime(MINUTE);

    expect(runs).toHaveLength(2);
  });

  it('clears nothing once stopped', () => {
    stopMaintenance();

    page.become('hidden');
    page.become('visible');
    vi.advanceTimersByTime(MAINTENANCE_INTERVAL_MS);

    expect(runs).toHaveLength(1);
  });
});
