/**
 * The value of stored JSON, null when there is none or it is unreadable -
 * what every backend reads a damaged entry as.
 */
export function parseStoredJson(json: string | null): unknown {
  try {
    return json === null ? null : JSON.parse(json);
  } catch {
    return null;
  }
}
