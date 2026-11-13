import { asOfAge, asOfReasonText, asOfTime } from './as-of-text';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const STORED = Date.parse('2026-11-08T09:05:00+01:00');

describe('asOfAge', () => {
  it.each([
    ['just now', 20_000, 'Stand: gerade eben'],
    ['a minute ago', MINUTE, 'Stand: vor 1 Min.'],
    ['59 minutes ago', 59 * MINUTE + 59_000, 'Stand: vor 59 Min.'],
    ['an hour ago', HOUR, 'Stand: vor 1 Std.'],
    ['two hours ago', 2 * HOUR + 30 * MINUTE, 'Stand: vor 2 Std.'],
    ['23 hours ago', 23 * HOUR + 59 * MINUTE, 'Stand: vor 23 Std.'],
    ['a day ago', DAY, 'Stand: vor 1 Tag'],
    ['three days ago', 3 * DAY + HOUR, 'Stand: vor 3 Tagen'],
  ])('says how old an answer of %s is', (_case, age, text) => {
    expect(asOfAge(STORED, STORED + age)).toBe(text);
  });

  it('takes an answer from a clock ahead of this one for one of just now', () => {
    expect(asOfAge(STORED, STORED - HOUR)).toBe('Stand: gerade eben');
  });
});

describe('asOfTime', () => {
  it('names the German day and time the answer came', () => {
    expect(asOfTime(STORED)).toBe('08.11.2026, 09:05');
  });
});

describe('asOfReasonText', () => {
  it.each([
    ['no-internet', 'Offline'],
    ['no-connection', 'Keine Verbindung'],
    ['unavailable', 'DBB nicht erreichbar'],
  ] as const)('names why a %s read shows its last answer', (reason, text) => {
    expect(asOfReasonText(reason)).toBe(text);
  });
});
