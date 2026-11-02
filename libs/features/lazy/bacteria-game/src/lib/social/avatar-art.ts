import { seeded } from '../state/geometry';
import { COLONY_COLORS } from '../state/colony-colors';
import { AVATAR_COUNT } from './profile';

/** How a drawn avatar looks: a wobbly bacterium with a face, in a colour. */
export interface AvatarArt {
  /** The body's outline, an SVG path in a 100 × 100 box. */
  body: string;
  fill: string;
  /** The darker rim and the face. */
  ink: string;
  /** The eyes' centres; a sleepy one gets lids. */
  eyes: readonly { x: number; y: number }[];
  sleepy: boolean;
}

/** The bacterium of a preset avatar - the same for an id everywhere. */
export function avatarArt(id: number): AvatarArt {
  const random = seeded(
    0x5eed + (((id % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT)
  );
  const [r, g, b] = COLONY_COLORS[id % COLONY_COLORS.length].rgb;
  const points = 9;
  const radii = Array.from({ length: points }, () => 34 + random() * 10);
  const at = (i: number) => {
    const angle = (i / points) * 2 * Math.PI;
    const radius = radii[i % points];
    return {
      x: 50 + Math.cos(angle) * radius,
      y: 52 + Math.sin(angle) * radius,
    };
  };
  // A closed curve through the points, smoothed with their midpoints.
  let body = '';
  for (let i = 0; i <= points; i++) {
    const p = at(i);
    const q = at(i + 1);
    const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    body +=
      i === 0
        ? `M${round(mid.x)} ${round(mid.y)}`
        : ` Q${round(p.x)} ${round(p.y)} ${round(mid.x)} ${round(mid.y)}`;
  }
  const spread = 10 + random() * 6;
  return {
    body: `${body} Z`,
    fill: `rgb(${r} ${g} ${b})`,
    ink: `rgb(${Math.round(r * 0.35)} ${Math.round(g * 0.35)} ${Math.round(b * 0.35)})`,
    eyes: [
      { x: 50 - spread, y: 46 },
      { x: 50 + spread, y: 46 },
    ],
    sleepy: id >= COLONY_COLORS.length,
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
