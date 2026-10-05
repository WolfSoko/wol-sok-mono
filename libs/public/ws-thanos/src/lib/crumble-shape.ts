import type { WsThanosCrumble } from './ws-thanos.options';

export interface CrumbleShape {
  /** half width of the coarse cracks in css pixels, particles closer to a crack break off */
  coarseCrack: number;
  /** half width of the fine cracks in css pixels */
  fineCrack: number;
  /** 0 to 1, how far the shards have shifted and tilted */
  shardGrow: number;
}

const NONE: CrumbleShape = { coarseCrack: 0, fineCrack: 0, shardGrow: 0 };

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** cracks get wider and finer cracks appear while the element decays */
export function crumbleShape(
  crumble: WsThanosCrumble,
  animationT: number
): CrumbleShape {
  if (crumble === 'dust') {
    return NONE;
  }
  if (crumble === 'chunks') {
    return {
      coarseCrack: (0.8 + 1.2 * smoothstep(0, 0.4, animationT)) / 2,
      fineCrack: 0,
      shardGrow: 0,
    };
  }
  return {
    coarseCrack: (0.8 + 4 * smoothstep(0, 0.55, animationT)) / 2,
    fineCrack: (2.5 * smoothstep(0.12, 0.6, animationT)) / 2,
    shardGrow: crumble === 'shards' ? smoothstep(0.03, 0.6, animationT) : 0,
  };
}
