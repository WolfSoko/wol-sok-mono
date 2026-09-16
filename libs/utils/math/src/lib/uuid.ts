export function uuid(): string {
  // Cryptographically strong bytes (works in insecure contexts too, unlike
  // `crypto.randomUUID()`), laid out as an RFC 4122 version 4 UUID.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

export function uuidToColor(uuid: string): string {
  let hash = 0;

  // easy hashing to make sure the hole string is used
  for (let i = 0; i < uuid.length; i++) {
    hash = hash * 31 + uuid.charCodeAt(i);
    hash = hash & hash; // Konvertieren zu 32bit Integer
  }

  // Convert to 6 letters hex
  let color = (hash & 0xffffff).toString(16);
  // Sicherstellen, dass der Farbcode 6 Zeichen lang ist
  color = '000000'.substring(0, 6 - color.length) + color;

  return `#${color}`;
}
