import type { StandGrund } from '../basketball-data/stand';

const MINUTE = 60_000;
const STUNDE = 60 * MINUTE;
const TAG = 24 * STUNDE;

const ZEIT = new Intl.DateTimeFormat('de-DE', {
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
export function standAlter(gespeichertAm: number, jetzt: number): string {
  return `Stand: ${alterText(Math.max(0, jetzt - gespeichertAm))}`;
}

/** When an answer came, in German time: `08.11.2026, 09:05`. */
export function standZeit(gespeichertAm: number): string {
  return ZEIT.format(new Date(gespeichertAm));
}

/** "Offline" only where the browser says so; else no server answered. */
const STAND_GRUENDE: Readonly<Record<StandGrund, string>> = {
  'kein-internet': 'Offline',
  'keine-verbindung': 'Keine Verbindung',
  unavailable: 'DBB nicht erreichbar',
};

/** Why a screen shows its last good answer. */
export function standGrundText(grund: StandGrund): string {
  return STAND_GRUENDE[grund];
}

function alterText(alter: number): string {
  if (alter < MINUTE) {
    return 'gerade eben';
  }
  if (alter < STUNDE) {
    return `vor ${Math.floor(alter / MINUTE)} Min.`;
  }
  if (alter < TAG) {
    return `vor ${Math.floor(alter / STUNDE)} Std.`;
  }
  const tage = Math.floor(alter / TAG);
  return tage === 1 ? 'vor 1 Tag' : `vor ${tage} Tagen`;
}
