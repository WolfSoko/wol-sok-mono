/** The `code` a Firebase error carries (`auth/…`, `permission-denied`), if any. */
export function fehlerCode(fehler: unknown): string | undefined {
  return typeof fehler === 'object' && fehler !== null && 'code' in fehler
    ? String(fehler.code)
    : undefined;
}
