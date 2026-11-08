const TAG = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

/** A Spiel's `datum` (`YYYY-MM-DD`) as the screens show it: `Sa., 29.08.2026`. */
export function spielTag(datum: string): string {
  return TAG.format(new Date(`${datum}T00:00:00Z`));
}

/** The day and, where the DBB has one, the tip-off: `So., 20.09.2026 · 09:00 Uhr`. */
export function spielTagUndUhrzeit(datum: string, uhrzeit?: string): string {
  const tag = spielTag(datum);
  return uhrzeit === undefined ? tag : `${tag} · ${uhrzeit} Uhr`;
}
