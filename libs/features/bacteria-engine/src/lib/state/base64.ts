/**
 * Packed replays as base64 text - as this device keeps them
 * (`LocalGameReplays`) and as `publicSite` serves a public one.
 */

/** `bytes` as base64, in chunks a call's arguments can take. */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** The bytes of base64 `text` - null when it is none. */
export function fromBase64(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}
