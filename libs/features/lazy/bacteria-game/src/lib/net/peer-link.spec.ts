import { CONNECT_TIMEOUT_MS, WebRtcTransport } from './peer-link';
import { PeerUnreachableError, type Relay } from './peer-transport';
import { RELAY_RENEW_MS } from './relay-renewal';

/** A data channel of the fake connection, by the id it was made with. */
function fakeChannel() {
  return {
    readyState: 'connecting' as RTCDataChannelState,
    onopen: null as (() => void) | null,
    onclose: null as (() => void) | null,
    onmessage: null as ((event: { data: unknown }) => void) | null,
    close: jest.fn(),
    send: jest.fn(),
  };
}

/** Enough of an RTCPeerConnection for the link: states set by the spec. */
class FakeRtcConnection {
  public static last: FakeRtcConnection | null = null;
  public connectionState: RTCPeerConnectionState = 'new';
  public iceGatheringState: RTCIceGatheringState = 'complete';
  public localDescription: { sdp: string } | null = null;
  public signalingState: RTCSignalingState = 'stable';
  public onconnectionstatechange: (() => void) | null = null;
  public onicegatheringstatechange: (() => void) | null = null;
  /** The channels made, by id: 0 the game's, 1 the link's own signals. */
  public readonly channels = new Map<number, ReturnType<typeof fakeChannel>>();
  public readonly restartIce = jest.fn();
  /** What `getStats()` resolves with: no selected pair unless set. */
  public stats: () => Promise<RTCStatsReport> = async () =>
    new Map() as unknown as RTCStatsReport;

  public constructor(public configuration: RTCConfiguration) {
    // As a browser refuses a configuration with a URL it cannot read.
    if (
      configuration.iceServers?.some(({ urls }) => String(urls) === 'turn:')
    ) {
      throw new SyntaxError('Invalid URL');
    }
    FakeRtcConnection.last = this;
  }

  /** The game's channel. */
  public get channel(): ReturnType<typeof fakeChannel> {
    const channel = this.channels.get(0);
    if (channel === undefined) {
      throw new Error('No game channel made.');
    }
    return channel;
  }

  public createDataChannel(_label: string, { id }: RTCDataChannelInit) {
    const channel = fakeChannel();
    this.channels.set(id ?? -1, channel);
    return channel;
  }
  public getConfiguration(): RTCConfiguration {
    return this.configuration;
  }
  public setConfiguration(configuration: RTCConfiguration): void {
    this.configuration = configuration;
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
  public getStats(): Promise<RTCStatsReport> {
    return this.stats();
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

  const relay = {
    urls: ['turn:turn.cloudflare.com:3478?transport=udp'],
    username: 'user',
    credential: 'secret',
  };
  const noRelay: Relay = { servers: [], fresh: async () => [] };

  it('reaches the other device through the STUN servers and the relay', async () => {
    await new WebRtcTransport().offer({
      servers: [relay],
      fresh: async () => [relay],
    });
    const servers = FakeRtcConnection.last?.configuration.iceServers ?? [];
    expect(servers.at(-1)).toEqual(relay);
    expect(String(servers[0]?.urls)).toMatch(/^stun:/);

    await new WebRtcTransport().answer('offer', noRelay);
    expect(
      FakeRtcConnection.last?.configuration.iceServers?.every(({ urls }) =>
        String(urls).startsWith('stun:')
      )
    ).toBe(true);
  });

  it('connects without the relay when the browser refuses it', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const bad = { ...relay, urls: ['turn:'] };

    await new WebRtcTransport().offer({
      servers: [bad],
      fresh: async () => [],
    });

    expect(
      FakeRtcConnection.last?.configuration.iceServers?.every(({ urls }) =>
        String(urls).startsWith('stun:')
      )
    ).toBe(true);
    warn.mockRestore();
  });

  it('renews the relay of an open link on the host, until it closes', async () => {
    const fresh = jest.fn(async () => [relay]);
    const { link } = await new WebRtcTransport().offer({
      servers: [relay],
      fresh,
    });
    const connection = FakeRtcConnection.last;
    const signal = connection?.channels.get(1);
    if (signal !== undefined) {
      signal.readyState = 'open';
    }
    connection?.channel.onopen?.();

    await jest.advanceTimersByTimeAsync(RELAY_RENEW_MS);
    expect(fresh).toHaveBeenCalledTimes(1);
    expect(connection?.restartIce).toHaveBeenCalled();

    link.close();
    await jest.advanceTimersByTimeAsync(RELAY_RENEW_MS);
    expect(fresh).toHaveBeenCalledTimes(1);
    expect(connection?.channels.get(1)?.close).toHaveBeenCalled();
  });

  it('leaves the renewal to the host on the guest', async () => {
    const fresh = jest.fn(async () => [relay]);
    await new WebRtcTransport().answer('offer', { servers: [relay], fresh });
    FakeRtcConnection.last?.channel.onopen?.();

    await jest.advanceTimersByTimeAsync(RELAY_RENEW_MS);

    expect(fresh).not.toHaveBeenCalled();
  });

  it('reads the route of the selected pair from the statistics', async () => {
    const { link } = await new WebRtcTransport().offer(noRelay);
    const connection = FakeRtcConnection.last;
    if (connection === null) {
      throw new Error('No connection made.');
    }
    const entries = [
      { id: 'L', type: 'local-candidate', candidateType: 'relay' },
      { id: 'R', type: 'remote-candidate', candidateType: 'srflx' },
      {
        id: 'P',
        type: 'candidate-pair',
        localCandidateId: 'L',
        remoteCandidateId: 'R',
      },
      { id: 'T', type: 'transport', selectedCandidatePairId: 'P' },
    ];
    connection.stats = async () =>
      new Map(
        entries.map((entry) => [entry.id, entry])
      ) as unknown as RTCStatsReport;

    await expect(link.route()).resolves.toBe('relay');
  });

  it('knows no route when the statistics cannot be read', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const { link } = await new WebRtcTransport().offer(noRelay);
    const connection = FakeRtcConnection.last;
    if (connection === null) {
      throw new Error('No connection made.');
    }
    connection.stats = async () => {
      throw new Error('closed');
    };

    await expect(link.route()).resolves.toBe('unknown');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('waits five seconds at most for the candidates', async () => {
    const offering = new WebRtcTransport().offer(noRelay);
    const connection = FakeRtcConnection.last;
    if (connection === null) {
      throw new Error('No connection made.');
    }
    connection.iceGatheringState = 'gathering';
    let done = false;
    void offering.then(() => (done = true));

    await jest.advanceTimersByTimeAsync(4999);
    expect(done).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });

  it('names a connection whose every way failed unreachable', async () => {
    const { link } = await new WebRtcTransport().answer('offer', noRelay);

    FakeRtcConnection.last?.moveTo('failed');

    await expect(link.opened).rejects.toEqual(
      new PeerUnreachableError('ice_failed')
    );
  });

  it('names a connection that never opened in time unreachable', async () => {
    const { link } = await new WebRtcTransport().answer('offer', noRelay);
    const opened = link.opened.catch((error: unknown) => error);

    await jest.advanceTimersByTimeAsync(CONNECT_TIMEOUT_MS);

    const error = await opened;
    expect(error).toBeInstanceOf(PeerUnreachableError);
    expect((error as PeerUnreachableError).kind).toBe('timeout');
  });

  it('keeps a plain error for a link closed on purpose', async () => {
    const { link } = await new WebRtcTransport().answer('offer', noRelay);

    link.close();

    await expect(link.opened).rejects.not.toBeInstanceOf(PeerUnreachableError);
  });
});
