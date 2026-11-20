import {
  CONNECT_TIMEOUT_MS,
  GATHER_TIMEOUT_MS,
  WebRtcTransport,
} from './peer-link';
import { PeerUnreachableError } from './peer-transport';

/** Enough of an RTCPeerConnection for the link: states set by the spec. */
class FakeRtcConnection {
  public static last: FakeRtcConnection | null = null;
  public connectionState: RTCPeerConnectionState = 'new';
  public iceGatheringState: RTCIceGatheringState = 'complete';
  public localDescription: { sdp: string } | null = null;
  public onconnectionstatechange: (() => void) | null = null;
  public onicegatheringstatechange: (() => void) | null = null;
  public readonly channel = {
    readyState: 'connecting',
    onopen: null as (() => void) | null,
    onclose: null as (() => void) | null,
    onmessage: null,
    close: jest.fn(),
    send: jest.fn(),
  };

  public constructor() {
    FakeRtcConnection.last = this;
  }

  public createDataChannel() {
    return this.channel;
  }
  public async createOffer() {
    return { type: 'offer', sdp: 'offer' };
  }
  public async createAnswer() {
    return { type: 'answer', sdp: 'answer' };
  }
  public async setLocalDescription(description: { sdp: string }) {
    this.localDescription = description;
  }
  public async setRemoteDescription() {
    return undefined;
  }
  public close(): void {
    this.connectionState = 'closed';
  }

  /** The connection state changes, as ICE reports it. */
  public moveTo(state: RTCPeerConnectionState): void {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}

describe('WebRtcTransport', () => {
  const original = globalThis.RTCPeerConnection;

  beforeEach(() => {
    jest.useFakeTimers();
    globalThis.RTCPeerConnection =
      FakeRtcConnection as unknown as typeof RTCPeerConnection;
  });

  afterEach(() => {
    jest.useRealTimers();
    globalThis.RTCPeerConnection = original;
  });

  it('waits five seconds at most for the candidates', async () => {
    const offering = new WebRtcTransport().offer();
    const connection = FakeRtcConnection.last;
    if (connection === null) {
      throw new Error('No connection made.');
    }
    connection.iceGatheringState = 'gathering';
    let done = false;
    void offering.then(() => (done = true));

    await jest.advanceTimersByTimeAsync(GATHER_TIMEOUT_MS - 1);
    expect(done).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    expect(GATHER_TIMEOUT_MS).toBe(5000);
  });

  it('names a connection whose every way failed unreachable', async () => {
    const { link } = await new WebRtcTransport().answer('offer');

    FakeRtcConnection.last?.moveTo('failed');

    await expect(link.opened).rejects.toEqual(
      new PeerUnreachableError('ice_failed')
    );
  });

  it('names a connection that never opened in time unreachable', async () => {
    const { link } = await new WebRtcTransport().answer('offer');
    const opened = link.opened.catch((error: unknown) => error);

    await jest.advanceTimersByTimeAsync(CONNECT_TIMEOUT_MS);

    const error = await opened;
    expect(error).toBeInstanceOf(PeerUnreachableError);
    expect((error as PeerUnreachableError).kind).toBe('timeout');
  });

  it('keeps a plain error for a link closed on purpose', async () => {
    const { link } = await new WebRtcTransport().answer('offer');

    link.close();

    await expect(link.opened).rejects.not.toBeInstanceOf(PeerUnreachableError);
  });
});
