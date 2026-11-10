import { TestBed } from '@angular/core/testing';
import { SPEICHER_FREIGEBEN } from '../geraete-speicher';
import { provideBasketballData } from './basketball-data.provider';
import {
  ANTWORT_PRAEFIX,
  MAX_ALTER_MS,
  PFLEGE_TAKT_MS,
} from '@wolsok/feat-korbjaeger-antworten';
import { LETZTE_ANTWORTEN } from './letzte-antworten-pflege';

const TEAM = '/api/dbb/team/313036/spiele';
const START = Date.parse('2026-11-08T12:00:00+01:00');
const MINUTE = 60_000;

/** Whether the device still keeps an answer at `TEAM`. */
function gemerkt(): boolean {
  return localStorage.getItem(`${ANTWORT_PRAEFIX}${TEAM}`) !== null;
}

/** An answer at `TEAM`, stored now; too old a week and a minute later. */
function merken(): void {
  TestBed.inject(LETZTE_ANTWORTEN).merken(TEAM, 'team-games', {
    antwort: { status: '0' },
    gespeichertAm: Date.now(),
  });
}

function sichtbarWerden(): void {
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('LETZTE_ANTWORTEN', () => {
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
      `${ANTWORT_PRAEFIX}${TEAM}`,
      JSON.stringify({ v: 2, am: START, art: 'team-spiele', antwort: {} })
    );
    vi.setSystemTime(START + MAX_ALTER_MS + MINUTE);

    TestBed.inject(LETZTE_ANTWORTEN);

    expect(gemerkt()).toBe(false);
  });

  it('deletes answers too old once the page comes back into view', () => {
    merken();
    vi.setSystemTime(START + MAX_ALTER_MS + MINUTE);

    sichtbarWerden();

    expect(gemerkt()).toBe(false);
  });

  it('stops with the app', () => {
    merken();
    TestBed.resetTestingModule();
    vi.setSystemTime(START + MAX_ALTER_MS + MINUTE);

    sichtbarWerden();
    vi.advanceTimersByTime(PFLEGE_TAKT_MS);

    expect(gemerkt()).toBe(true);
  });

  it('has the answers give way when Meine Teams need the room', () => {
    TestBed.configureTestingModule({ providers: [provideBasketballData()] });
    merken();

    TestBed.inject(SPEICHER_FREIGEBEN)();

    expect(gemerkt()).toBe(false);
  });
});
