import { standAlter, standGrundText, standZeit } from './stand-text';

const MINUTE = 60_000;
const STUNDE = 60 * MINUTE;
const TAG = 24 * STUNDE;
const GESPEICHERT = Date.parse('2026-11-08T09:05:00+01:00');

describe('standAlter', () => {
  it.each([
    ['just now', 20_000, 'Stand: gerade eben'],
    ['a minute ago', MINUTE, 'Stand: vor 1 Min.'],
    ['59 minutes ago', 59 * MINUTE + 59_000, 'Stand: vor 59 Min.'],
    ['an hour ago', STUNDE, 'Stand: vor 1 Std.'],
    ['two hours ago', 2 * STUNDE + 30 * MINUTE, 'Stand: vor 2 Std.'],
    ['23 hours ago', 23 * STUNDE + 59 * MINUTE, 'Stand: vor 23 Std.'],
    ['a day ago', TAG, 'Stand: vor 1 Tag'],
    ['three days ago', 3 * TAG + STUNDE, 'Stand: vor 3 Tagen'],
  ])('says how old an answer of %s is', (_fall, alter, text) => {
    expect(standAlter(GESPEICHERT, GESPEICHERT + alter)).toBe(text);
  });

  it('takes an answer from a clock ahead of this one for one of just now', () => {
    expect(standAlter(GESPEICHERT, GESPEICHERT - STUNDE)).toBe(
      'Stand: gerade eben'
    );
  });
});

describe('standZeit', () => {
  it('names the German day and time the answer came', () => {
    expect(standZeit(GESPEICHERT)).toBe('08.11.2026, 09:05');
  });
});

describe('standGrundText', () => {
  it.each([
    ['kein-internet', 'Offline'],
    ['keine-verbindung', 'Keine Verbindung'],
    ['unavailable', 'DBB nicht erreichbar'],
  ] as const)('names why a %s read shows its last answer', (grund, text) => {
    expect(standGrundText(grund)).toBe(text);
  });
});
