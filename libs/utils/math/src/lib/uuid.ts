export function uuid(): string {
  let dt = new Date().getTime();
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (dt + Math.random() * 16) % 16 | 0;
    dt = Math.floor(dt / 16);
    return (c == 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
  return uuid;
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
