import { TestBed } from '@angular/core/testing';
import { FREE_STORAGE } from '../device-storage';
import { provideBasketballData } from './basketball-data.provider';
import {
  ANSWER_PREFIX,
  MAX_AGE_MS,
  MAINTENANCE_INTERVAL_MS,
} from '@wolsok/feat-korbjaeger-answers';
import { ANSWER_CACHE } from './answer-cache-maintenance';

const TEAM = '/api/dbb/team/313036/spiele';
const START = Date.parse('2026-11-08T12:00:00+01:00');
const MINUTE = 60_000;

/** Whether the device still keeps an answer at `TEAM`. */
function remembered(): boolean {
  return localStorage.getItem(`${ANSWER_PREFIX}${TEAM}`) !== null;
}

/** An answer at `TEAM`, stored now; too old a week and a minute later. */
function remember(): void {
  TestBed.inject(ANSWER_CACHE).store(TEAM, 'team-games', {
    answer: { status: '0' },
    storedAt: Date.now(),
  });
}

function becomeVisible(): void {
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('ANSWER_CACHE', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deletes answers too old as soon as it is first taken', () => {
    localStorage.setItem(
      `${ANSWER_PREFIX}${TEAM}`,
      JSON.stringify({ v: 2, am: START, art: 'team-spiele', antwort: {} })
    );
    vi.setSystemTime(START + MAX_AGE_MS + MINUTE);

    TestBed.inject(ANSWER_CACHE);

    expect(remembered()).toBe(false);
  });

  it('deletes answers too old once the page comes back into view', () => {
    remember();
    vi.setSystemTime(START + MAX_AGE_MS + MINUTE);

    becomeVisible();

    expect(remembered()).toBe(false);
  });

  it('stops with the app', () => {
    remember();
    TestBed.resetTestingModule();
    vi.setSystemTime(START + MAX_AGE_MS + MINUTE);

    becomeVisible();
    vi.advanceTimersByTime(MAINTENANCE_INTERVAL_MS);

    expect(remembered()).toBe(true);
  });

  it('has the answers give way when Meine Teams need the room', () => {
    TestBed.configureTestingModule({ providers: [provideBasketballData()] });
    remember();

    TestBed.inject(FREE_STORAGE)();

    expect(remembered()).toBe(false);
  });
});
