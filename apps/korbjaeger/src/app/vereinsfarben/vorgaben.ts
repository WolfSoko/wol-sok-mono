/** A colour the bottom sheet offers, with the name a screen reader says for it. */
export interface Vorgabe {
  readonly name: string;
  readonly farbe: string;
}

/**
 * The colours the bottom sheet "Vereinsfarben" offers (#2918): those most
 * clubs wear. Every one keeps its text readable once Material derives a
 * scheme from it (`farbschema.spec.ts`).
 */
export const VORGABEN: readonly Vorgabe[] = [
  { name: 'Rot', farbe: '#c8102e' },
  { name: 'Königsblau', farbe: '#1d4ed8' },
  { name: 'Marine', farbe: '#0b1f4b' },
  { name: 'Grün', farbe: '#007a3d' },
  { name: 'Gelb', farbe: '#ffd700' },
  { name: 'Schwarz', farbe: '#000000' },
  { name: 'Weiß', farbe: '#ffffff' },
  { name: 'Orange', farbe: '#f57c00' },
  { name: 'Lila', farbe: '#6a1b9a' },
  { name: 'Weinrot', farbe: '#7a003c' },
  { name: 'Himmelblau', farbe: '#4fc3f7' },
  { name: 'Grau', farbe: '#808080' },
];
