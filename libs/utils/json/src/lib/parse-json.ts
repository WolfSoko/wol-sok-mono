/**
 * The value of JSON text, null where there is none or it is unreadable:
 * the caller checks the shape.
 */
export function parseJson(text: string | null): unknown {
  if (text === null) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
