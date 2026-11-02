import { WS_THANOS_CRUMBLES, type WsThanosCrumble } from '@wolsok/thanos';

/** a random crumble variant, another one than the last if given */
export function randomCrumble(last?: WsThanosCrumble): WsThanosCrumble {
  const choices = WS_THANOS_CRUMBLES.filter((crumble) => crumble !== last);
  return choices[Math.floor(Math.random() * choices.length)];
}
