import type { WsThanosCrumble } from '@wolsok/thanos';

const CRUMBLES: readonly WsThanosCrumble[] = [
  'dust',
  'cracks',
  'shards',
  'chunks',
];

/** a random crumble variant, another one than the last if given */
export function randomCrumble(last?: WsThanosCrumble): WsThanosCrumble {
  const choices = CRUMBLES.filter((crumble) => crumble !== last);
  return choices[Math.floor(Math.random() * choices.length)];
}
