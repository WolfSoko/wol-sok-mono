import type { Observable } from 'rxjs';

/**
 * A direct connection to the other device of an online match: ordered and
 * reliable, for the inputs and the match's messages.
 */
export interface PeerConnection {
  /** What the other device sends, as it sent it. */
  readonly messages$: Observable<string>;
  /** Emits once the connection is gone - closed by either side, or lost. */
  readonly closed$: Observable<void>;
  /** Resolves once the connection is open, rejects when it never opens. */
  readonly opened: Promise<void>;
  /** Takes the guest's answer - the host's side of the handshake. */
  accept(answer: string): Promise<void>;
  /** Sends a message, dropped once the connection is no longer open. */
  send(message: string): void;
  close(): void;
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
  /** A connection for the host, with the offer to pass on to the guest. */
  offer(): Promise<{ link: PeerConnection; offer: string }>;
  /** A connection for the guest, answering the host's offer. */
  answer(offer: string): Promise<{ link: PeerConnection; answer: string }>;
}
