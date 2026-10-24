/**
 * Loudness of the snap sound layers over the animation progress (0 to 1).
 * The element breaks with a rumble, then the wind slowly grows stronger and
 * carries crackling sand, both get weaker in the last third and fade away.
 */

/** part of the animation after which the sound has blown away */
export const SILENT_AT = 0.85;

/** part of the animation after which the rumble of the breaking element is over */
export const RUMBLE_END = 0.33;

const WIND_PEAK = 0.6;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** everything fades from the peak of the wind until it is silent */
function fadeAway(progress: number, from: number): number {
  return 1 - smoothstep(from, SILENT_AT, progress);
}

/** the element breaks: a loud rumble right at the start that dies away within the first third */
export function rumbleEnvelope(progress: number): number {
  if (progress >= RUMBLE_END) {
    return 0;
  }
  const attack = smoothstep(0, 0.004, progress);
  const decay = Math.exp(-Math.max(0, progress - 0.004) / 0.06);
  return attack * decay * fadeAway(progress, 0.25);
}

/** the wind starts quietly and slowly grows stronger, then fades in the last third */
export function windEnvelope(progress: number): number {
  const fadeIn = smoothstep(0, 0.04, progress);
  const grow = 0.15 + 0.85 * smoothstep(0.02, WIND_PEAK, progress);
  return fadeIn * grow * fadeAway(progress, WIND_PEAK);
}

/** sand crackles as the wind picks it up, gets weaker in the last third and fades */
export function sandEnvelope(progress: number): number {
  return smoothstep(0.06, 0.55, progress) * fadeAway(progress, 0.58);
}
