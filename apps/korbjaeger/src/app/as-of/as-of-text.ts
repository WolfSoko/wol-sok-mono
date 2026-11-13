import type { AsOfReason } from '../basketball-data/as-of';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const TIME_OF_DAY = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Berlin',
});

/**
 * How old an answer stored at `gespeichertAm` is at `jetzt` (both ms since
 * the epoch), as the screens label it: `Stand: vor 2 Std.`.
 */
export function asOfAge(storedAt: number, now: number): string {
  return `Stand: ${ageText(Math.max(0, now - storedAt))}`;
}

/** When an answer came, in German time: `08.11.2026, 09:05`. */
export function asOfTime(storedAt: number): string {
  return TIME_OF_DAY.format(new Date(storedAt));
}

/** "Offline" only where the browser says so; else no server answered. */
const AS_OF_REASONS: Readonly<Record<AsOfReason, string>> = {
  'no-internet': 'Offline',
  'no-connection': 'Keine Verbindung',
  unavailable: 'DBB nicht erreichbar',
};

/** Why a screen shows its last good answer. */
export function asOfReasonText(reason: AsOfReason): string {
  return AS_OF_REASONS[reason];
}

function ageText(age: number): string {
  if (age < MINUTE) {
    return 'gerade eben';
  }
  if (age < HOUR) {
    return `vor ${Math.floor(age / MINUTE)} Min.`;
  }
  if (age < DAY) {
    return `vor ${Math.floor(age / HOUR)} Std.`;
  }
  const days = Math.floor(age / DAY);
  return days === 1 ? 'vor 1 Tag' : `vor ${days} Tagen`;
}
