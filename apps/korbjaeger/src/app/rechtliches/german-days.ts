/**
 * A number of days as the privacy policy's German text says it, in the
 * accusative it uses ("noch einen Tag lang", "bis zu 7 Tage lang"):
 * `further` adds "weitere" ("spätestens einen weiteren Tag später").
 */
export function germanDays(
  days: number,
  { further = false }: { further?: boolean } = {}
): string {
  if (days === 1) {
    return further ? 'einen weiteren Tag' : 'einen Tag';
  }
  return further ? `${days} weitere Tage` : `${days} Tage`;
}
