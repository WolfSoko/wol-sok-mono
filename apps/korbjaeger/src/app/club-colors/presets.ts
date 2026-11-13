/** A colour the bottom sheet offers, with the name a screen reader says for it. */
export interface Preset {
  readonly name: string;
  readonly color: string;
}

/**
 * The colours the bottom sheet "Vereinsfarben" offers (#2918): those most
 * clubs wear. Every one keeps its text readable once Material derives a
 * scheme from it (`color-scheme.spec.ts`).
 */
export const PRESETS: readonly Preset[] = [
  { name: 'Rot', color: '#c8102e' },
  { name: 'Königsblau', color: '#1d4ed8' },
  { name: 'Marine', color: '#0b1f4b' },
  { name: 'Grün', color: '#007a3d' },
  { name: 'Gelb', color: '#ffd700' },
  { name: 'Schwarz', color: '#000000' },
  { name: 'Weiß', color: '#ffffff' },
  { name: 'Orange', color: '#f57c00' },
  { name: 'Lila', color: '#6a1b9a' },
  { name: 'Weinrot', color: '#7a003c' },
  { name: 'Himmelblau', color: '#4fc3f7' },
  { name: 'Grau', color: '#808080' },
];
