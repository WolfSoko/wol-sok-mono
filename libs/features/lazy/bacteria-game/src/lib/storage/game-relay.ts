import type { RelayEntry } from '@wolsok/feat-shared-bacteria-engine/cloud';

/**
 * A TURN server an online match may go through when the two devices cannot
 * reach each other directly (ADR 0020) - what `RTCIceServer` takes, as
 * `relay/turn` keeps it.
 */
export type RelayServer = RelayEntry;

/**
 * Where the game gets the TURN relay's short-lived credentials before it
 * connects to another device: `relay/turn` in the game's project
 * (`FirestoreGameRelay`), asked of `GameCloud.relay()` - null without a
 * project. Never rejects: no usable credentials, a failed or a slow read
 * all answer no servers, and the devices then connect without a relay.
 */
export interface GameRelay {
  servers(): Promise<readonly RelayServer[]>;
}
