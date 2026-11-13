/** The `code` a Firebase error carries (`auth/…`, `permission-denied`), if any. */
export function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : undefined;
}
