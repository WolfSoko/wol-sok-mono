import { Player } from './player.model';

/**
 * A hash of what the players of a match have come to - their colonies and
 * crosshairs. Two devices that played the same match agree on it to the
 * bit, and so does a replay of it played again (ADR 0011).
 */
export function matchChecksum(players: readonly Player[]): number {
  const view = new DataView(new ArrayBuffer(8));
  let hash = 0x811c9dc5;
  const add = (value: number) => {
    view.setFloat64(0, value);
    for (let i = 0; i < 8; i++) {
      hash = Math.imul(hash ^ view.getUint8(i), 0x01000193);
    }
  };
  for (const player of players) {
    add(player.bacteriaCount);
    add(player.captured);
    add(player.lost);
    add(player.x);
    add(player.y);
    add(player.boostCooldownSec);
  }
  return hash >>> 0;
}
