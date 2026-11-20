import { Observable, Subject } from 'rxjs';
import type { RelayServer } from '../storage/game-relay';
import { iceServers } from './ice-servers';
import {
  type PeerConnection,
  type PeerTransport,
  PeerUnreachableError,
  type Relay,
  type UnreachableKind,
} from './peer-transport';
import { RelayRenewal } from './relay-renewal';

/**
 * The longest wait for the candidates - the ways this device can be
 * reached - before the offer or answer goes out with those found so far.
 * A slow mobile network brings the one the STUN server tells late.
 */
export const GATHER_TIMEOUT_MS = 5000;

/** How long a guest may take to connect once it answered. */
export const CONNECT_TIMEOUT_MS = 20_000;

/**
 * The game's {@link PeerTransport}: a WebRTC data channel between the two
 * devices.
 *
 * The offer and the answer carry every candidate at once rather than one
 * by one, so the room only has to pass on one string each way.
 */
export class WebRtcTransport implements PeerTransport {
  public supported(): boolean {
    return typeof RTCPeerConnection === 'function';
  }

  public async offer(
    relay: Relay
  ): Promise<{ link: PeerConnection; offer: string }> {
    const { link, description } = await negotiate(
      relay,
      'host',
      async (connection) =>
        connection.setLocalDescription(await connection.createOffer())
    );
    return { link, offer: description };
  }

  public async answer(
    offer: string,
    relay: Relay
  ): Promise<{ link: PeerConnection; answer: string }> {
    const { link, description } = await negotiate(
      relay,
      'guest',
      async (connection) => {
        await connection.setRemoteDescription({ type: 'offer', sdp: offer });
        await connection.setLocalDescription(await connection.createAnswer());
      }
    );
    link.giveUpLater();
    return { link, answer: description };
  }
}

/**
 * A new link, reaching the other device through the STUN servers and
 * `relay`, and its local description once `steps` set it - the link closed
 * again when they fail.
 */
async function negotiate(
  relay: Relay,
  role: 'host' | 'guest',
  steps: (connection: RTCPeerConnection) => Promise<void>
): Promise<{ link: PeerLink; description: string }> {
  const connection = connectionThrough(relay.servers);
  const link = new PeerLink(connection, relay, role);
  try {
    await steps(connection);
    return { link, description: await link.description() };
  } catch (error) {
    link.close();
    throw error;
  }
}

/**
 * A connection through the STUN servers and `relay` - without the relay
 * when the browser refuses it, which would cost the STUN servers too.
 */
function connectionThrough(relay: readonly RelayServer[]): RTCPeerConnection {
  try {
    return new RTCPeerConnection({ iceServers: iceServers(relay) });
  } catch (error) {
    if (relay.length === 0) {
      throw error;
    }
    console.warn('The relay was refused; connecting without it', error);
    return new RTCPeerConnection({ iceServers: iceServers([]) });
  }
}

/** One WebRTC data channel to the other device, made by {@link negotiate}. */
class PeerLink implements PeerConnection {
  private readonly incoming = new Subject<string>();
  private readonly ended = new Subject<void>();
  private readonly channel: RTCDataChannel;
  /** The link's own messages, apart from the game's: the relay's renewal. */
  private readonly signal: RTCDataChannel;
  private readonly renewal: RelayRenewal;
  private closed = false;
  /** Why the handshake never got through, once it did not. */
  private unreachable: UnreachableKind | null = null;
  /** Gives up on a handshake that never gets through. */
  private timeout?: ReturnType<typeof setTimeout>;

  /** What the other device sends, as it sent it. */
  public readonly messages$: Observable<string> = this.incoming.asObservable();
  /** Emits once the connection is gone - closed by either side, or lost. */
  public readonly closed$: Observable<void> = this.ended.asObservable();
  /** Resolves once the channel is open, rejects when it never opens. */
  public readonly opened: Promise<void>;

  public constructor(
    private readonly connection: RTCPeerConnection,
    relay: Relay,
    role: 'host' | 'guest'
  ) {
    // Negotiated: both sides make the same channels, neither waits for them.
    this.channel = connection.createDataChannel('game', {
      negotiated: true,
      id: 0,
      ordered: true,
    });
    this.signal = connection.createDataChannel('signal', {
      negotiated: true,
      id: 1,
      ordered: true,
    });
    this.renewal = new RelayRenewal(
      connection,
      this.signal,
      () => relay.fresh(),
      () => this.description()
    );
    this.channel.onmessage = (event) => {
      if (typeof event.data === 'string') {
        this.incoming.next(event.data);
      }
    };
    this.channel.onclose = () => this.close();
    connection.onconnectionstatechange = () => {
      const state = connection.connectionState;
      if (state === 'failed') {
        this.close('ice_failed');
      } else if (state === 'closed') {
        this.close();
      }
    };
    this.opened = new Promise((resolve, reject) => {
      this.channel.onopen = () => {
        clearTimeout(this.timeout);
        if (role === 'host') {
          this.renewal.start();
        }
        resolve();
      };
      this.ended.subscribe(() => {
        clearTimeout(this.timeout);
        reject(
          this.unreachable === null
            ? new Error('The connection closed.')
            : new PeerUnreachableError(this.unreachable)
        );
      });
    });
    // Rejections are handled where it is awaited; this one only waits.
    this.opened.catch(() => undefined);
  }

  /** Takes the guest's answer - the host's side of the handshake. */
  public async accept(answer: string): Promise<void> {
    this.giveUpLater();
    await this.connection.setRemoteDescription({ type: 'answer', sdp: answer });
  }

  /** Sends a message, dropped once the channel is no longer open. */
  public send(message: string): void {
    if (this.channel.readyState === 'open') {
      this.channel.send(message);
    }
  }

  /**
   * Closes the link - `unreachable` saying why a handshake never got
   * through, which `opened` then rejects with.
   */
  public close(unreachable: UnreachableKind | null = null): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.unreachable = unreachable;
    clearTimeout(this.timeout);
    this.renewal.stop();
    this.channel.close();
    this.signal.close();
    this.connection.close();
    this.ended.next();
    this.ended.complete();
    this.incoming.complete();
  }

  /** Closes the link unless it opens within {@link CONNECT_TIMEOUT_MS}. */
  public giveUpLater(): void {
    this.timeout ??= setTimeout(
      () => this.close('timeout'),
      CONNECT_TIMEOUT_MS
    );
  }

  /** The local description with every candidate found in time. */
  public async description(): Promise<string> {
    const { connection } = this;
    if (connection.iceGatheringState !== 'complete') {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, GATHER_TIMEOUT_MS);
        connection.onicegatheringstatechange = () => {
          if (connection.iceGatheringState === 'complete') {
            clearTimeout(timeout);
            resolve();
          }
        };
      });
    }
    return connection.localDescription?.sdp ?? '';
  }
}
