import { Observable, Subject } from 'rxjs';
import type { PeerConnection, PeerTransport } from './peer-transport';

/**
 * Public STUN servers, which tell a device the address the internet sees it
 * under. There is no TURN server: two devices behind strict NATs - some
 * mobile networks, some offices - cannot reach each other, and are told so.
 */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

/**
 * The longest wait for the candidates - the ways this device can be
 * reached - before the offer or answer goes out with those found so far.
 */
const GATHER_TIMEOUT_MS = 3000;

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

  public async offer(): Promise<{ link: PeerConnection; offer: string }> {
    const { link, description } = await negotiate(async (connection) =>
      connection.setLocalDescription(await connection.createOffer())
    );
    return { link, offer: description };
  }

  public async answer(
    offer: string
  ): Promise<{ link: PeerConnection; answer: string }> {
    const { link, description } = await negotiate(async (connection) => {
      await connection.setRemoteDescription({ type: 'offer', sdp: offer });
      await connection.setLocalDescription(await connection.createAnswer());
    });
    link.giveUpLater();
    return { link, answer: description };
  }
}

/**
 * A new link and its local description once `steps` set it - the link
 * closed again when they fail.
 */
async function negotiate(
  steps: (connection: RTCPeerConnection) => Promise<void>
): Promise<{ link: PeerLink; description: string }> {
  const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const link = new PeerLink(connection);
  try {
    await steps(connection);
    return { link, description: await link.description() };
  } catch (error) {
    link.close();
    throw error;
  }
}

/** One WebRTC data channel to the other device, made by {@link negotiate}. */
class PeerLink implements PeerConnection {
  private readonly incoming = new Subject<string>();
  private readonly ended = new Subject<void>();
  private readonly channel: RTCDataChannel;
  private closed = false;
  /** Gives up on a handshake that never gets through. */
  private timeout?: ReturnType<typeof setTimeout>;

  /** What the other device sends, as it sent it. */
  public readonly messages$: Observable<string> = this.incoming.asObservable();
  /** Emits once the connection is gone - closed by either side, or lost. */
  public readonly closed$: Observable<void> = this.ended.asObservable();
  /** Resolves once the channel is open, rejects when it never opens. */
  public readonly opened: Promise<void>;

  public constructor(private readonly connection: RTCPeerConnection) {
    // Negotiated: both sides make the same channel, neither waits for it.
    this.channel = connection.createDataChannel('game', {
      negotiated: true,
      id: 0,
      ordered: true,
    });
    this.channel.onmessage = (event) => {
      if (typeof event.data === 'string') {
        this.incoming.next(event.data);
      }
    };
    this.channel.onclose = () => this.close();
    connection.onconnectionstatechange = () => {
      const state = connection.connectionState;
      if (state === 'failed' || state === 'closed') {
        this.close();
      }
    };
    this.opened = new Promise((resolve, reject) => {
      this.channel.onopen = () => {
        clearTimeout(this.timeout);
        resolve();
      };
      this.ended.subscribe(() => {
        clearTimeout(this.timeout);
        reject(new Error('The connection closed.'));
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

  public close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    clearTimeout(this.timeout);
    this.channel.close();
    this.connection.close();
    this.ended.next();
    this.ended.complete();
    this.incoming.complete();
  }

  /** Closes the link unless it opens within {@link CONNECT_TIMEOUT_MS}. */
  public giveUpLater(): void {
    this.timeout ??= setTimeout(() => this.close(), CONNECT_TIMEOUT_MS);
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
