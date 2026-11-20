import type { RelayServer } from '../storage/game-relay';
import {
  RELAY_RENEW_MS,
  RelayRenewal,
  RENEW_ANSWER_TIMEOUT_MS,
} from './relay-renewal';

const fresh: RelayServer = {
  urls: ['turn:turn.cloudflare.com:3478?transport=udp'],
  username: 'fresh',
  credential: 'secret',
};

/** Enough of a connection for the renewal: what it was told, in order. */
class FakeConnection {
  public signalingState: RTCSignalingState = 'stable';
  public readonly calls: string[] = [];
  public configuration: RTCConfiguration = {
    iceServers: [],
    bundlePolicy: 'balanced',
  };

  public getConfiguration(): RTCConfiguration {
    return this.configuration;
  }
  public setConfiguration(configuration: RTCConfiguration): void {
    this.calls.push('configure');
    this.configuration = configuration;
  }
  public restartIce(): void {
    this.calls.push('restart');
  }
  public async createOffer() {
    return { type: 'offer' as const, sdp: 'offer' };
  }
  public async createAnswer() {
    return { type: 'answer' as const, sdp: 'answer' };
  }
  public async setLocalDescription(description: RTCSessionDescriptionInit) {
    this.calls.push(`local:${description.type}`);
    this.signalingState =
      description.type === 'offer' ? 'have-local-offer' : 'stable';
  }
  public async setRemoteDescription(description: RTCSessionDescriptionInit) {
    this.calls.push(`remote:${description.type}`);
    this.signalingState =
      description.type === 'offer' ? 'have-remote-offer' : 'stable';
  }
}

/** A data channel whose sends land in the other end's `onmessage`. */
class FakeChannel {
  public readyState: RTCDataChannelState = 'open';
  public onmessage: ((event: { data: unknown }) => void) | null = null;
  public other: FakeChannel | null = null;
  public readonly sent: string[] = [];

  public send(data: string): void {
    this.sent.push(data);
    const other = this.other;
    queueMicrotask(() => other?.onmessage?.({ data }));
  }
}

/** A host's and a guest's renewal, their channels joined. */
function pair(servers: readonly RelayServer[] = [fresh]) {
  const channels = [new FakeChannel(), new FakeChannel()] as const;
  channels[0].other = channels[1];
  channels[1].other = channels[0];
  const connections = [new FakeConnection(), new FakeConnection()] as const;
  const fetched = jest.fn(async () => servers);
  const renewals = connections.map(
    (connection, i) =>
      new RelayRenewal(
        connection as unknown as RTCPeerConnection,
        channels[i] as unknown as RTCDataChannel,
        fetched,
        async () => (i === 0 ? 'host-sdp' : 'guest-sdp')
      )
  );
  return {
    channels,
    connections,
    fetched,
    host: renewals[0],
    guest: renewals[1],
  };
}

/** Lets the offer, the answer and their awaits run through. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 20; turn++) {
    await jest.advanceTimersByTimeAsync(0);
  }
}

describe('RelayRenewal', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it(`renews the relay every ${RELAY_RENEW_MS / 60_000} minutes, once started`, async () => {
    const { host, fetched } = pair();
    host.start();

    await jest.advanceTimersByTimeAsync(RELAY_RENEW_MS - 1);
    expect(fetched).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    await settle();
    expect(fetched).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(RELAY_RENEW_MS);
    await settle();
    expect(fetched).toHaveBeenCalledTimes(4);
    host.stop();
  });

  it('restarts ICE on fresh credentials, on both devices', async () => {
    const { host, connections, channels } = pair();

    await host.renew();
    await settle();

    expect(connections[0].calls).toEqual([
      'configure',
      'restart',
      'local:offer',
      'remote:answer',
    ]);
    expect(connections[1].calls).toEqual([
      'configure',
      'remote:offer',
      'local:answer',
    ]);
    expect(connections[0].configuration).toEqual({
      bundlePolicy: 'balanced',
      iceServers: [expect.objectContaining({ urls: expect.any(Array) }), fresh],
    });
    expect(channels[0].sent.map((sent) => JSON.parse(sent))).toEqual([
      { t: 'offer', sdp: 'host-sdp' },
    ]);
    expect(channels[1].sent.map((sent) => JSON.parse(sent))).toEqual([
      { t: 'answer', sdp: 'guest-sdp' },
    ]);
  });

  it('renews nothing without credentials', async () => {
    const { host, connections, channels } = pair([]);

    await host.renew();

    expect(connections[0].calls).toEqual([]);
    expect(channels[0].sent).toEqual([]);
  });

  it('takes its offer back when no answer comes, as from a device of an older version', async () => {
    const { host, connections, channels } = pair();
    channels[0].other = null;

    await host.renew();
    await jest.advanceTimersByTimeAsync(RENEW_ANSWER_TIMEOUT_MS);

    expect(connections[0].calls.at(-1)).toBe('local:rollback');
    expect(connections[0].signalingState).toBe('stable');
  });

  it('renews nothing once stopped', async () => {
    const { host, fetched, channels } = pair();
    host.start();
    host.stop();
    channels[0].readyState = 'closed';

    await jest.advanceTimersByTimeAsync(RELAY_RENEW_MS);

    expect(fetched).not.toHaveBeenCalled();
  });

  it('ignores what it cannot read on the signal channel', async () => {
    const { channels, connections } = pair();

    channels[1].onmessage?.({ data: 'not json' });
    channels[1].onmessage?.({ data: '{"t":"other"}' });
    await settle();

    expect(connections[1].calls).toEqual([]);
  });
});
