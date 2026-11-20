import type { Observable } from 'rxjs';
import type { RelayServer } from '../storage/game-relay';
import type { ConnectionRoute } from './connection-route';

/**
 * A direct connection to the other device of an online match: ordered and
 * reliable, for the inputs and the match's messages.
 */
export interface PeerConnection {
  /** What the other device sends, as it sent it. */
  readonly messages$: Observable<string>;
  /** Emits once the connection is gone - closed by either side, or lost. */
  readonly closed$: Observable<void>;
  /**
   * Resolves once the connection is open, rejects when it never opens -
   * with a {@link PeerUnreachableError} when the other device could not be
   * reached at all.
   */
  readonly opened: Promise<void>;
  /** Takes the guest's answer - the host's side of the handshake. */
  accept(answer: string): Promise<void>;
  /** Sends a message, dropped once the connection is no longer open. */
  send(message: string): void;
  /** How the open connection carries the match: direct or through the relay. */
  route(): Promise<ConnectionRoute>;
  close(): void;
}

/**
 * The TURN relay a connection may go through (ADR 0020): its servers now,
 * none without credentials, and fresh ones for a connection that outlasts
 * their hour.
 */
export interface Relay {
  servers: readonly RelayServer[];
  fresh(): Promise<readonly RelayServer[]>;
}

/**
 * How two devices connect directly: the host makes an offer, the room
 * carries it to the guest, the guest's answer goes back the same way.
 * WebRTC in the game (`WebRtcTransport`), `pairedTransport()` from the
 * lib's testing folder in specs; `OnlineMatchService` injects it through
 * `PEER_TRANSPORT`.
 */
export interface PeerTransport {
  /** True where this device can make a direct connection at all. */
  supported(): boolean;
  /**
   * A connection for the host, with the offer to pass on to the guest -
   * through `relay` too where the devices cannot reach each other directly.
   */
  offer(relay: Relay): Promise<{ link: PeerConnection; offer: string }>;
  /** A connection for the guest, answering the host's offer. */
  answer(
    offer: string,
    relay: Relay
  ): Promise<{ link: PeerConnection; answer: string }>;
}

/**
 * Why the other device could not be reached: `ice_failed` when every way
 * to it failed - strict NATs, which only a relay gets through - and
 * `timeout` when the connection did not open in time.
 */
export type UnreachableKind = 'ice_failed' | 'timeout';

/** The rejection of {@link PeerConnection.opened} for an unreachable device. */
export class PeerUnreachableError extends Error {
  public constructor(public readonly kind: UnreachableKind) {
    super(`The other device could not be reached (${kind}).`);
    this.name = 'PeerUnreachableError';
  }
}
