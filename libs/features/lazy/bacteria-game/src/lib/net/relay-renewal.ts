import type { RelayServer } from '../storage/game-relay';
import { iceServers } from './ice-servers';

/**
 * How often the host renews the relay of an open link: well inside the
 * credentials' hour (handed out with 20 minutes left at least), since a
 * relayed connection dies once they expired and Chrome refreshes its
 * allocation (ADR 0020; measured with `tools-relay:check`).
 */
export const RELAY_RENEW_MS = 15 * 60_000;

/** How long the host waits for the guest's answer before it takes its offer back. */
export const RENEW_ANSWER_TIMEOUT_MS = 20_000;

/** What the two devices pass on the signal channel. */
interface Signal {
  t: 'offer' | 'answer';
  sdp: string;
}

function parseSignal(data: unknown): Signal | null {
  try {
    const value: unknown = typeof data === 'string' ? JSON.parse(data) : null;
    const { t, sdp } = (value ?? {}) as Record<string, unknown>;
    return (t === 'offer' || t === 'answer') && typeof sdp === 'string'
      ? { t, sdp }
      : null;
  } catch {
    return null;
  }
}

/**
 * Keeps an open link's relay alive past its credentials (ADR 0020): fresh
 * credentials alone do not (`setConfiguration` is not enough), an ICE
 * restart with them does. The host offers it every {@link RELAY_RENEW_MS}
 * over the link's own signal channel; the guest takes fresh credentials
 * too and answers. Only the host offers, so the two never offer at once.
 * The match's messages go on meanwhile over the game channel; a device of
 * an older version, without the signal channel, never answers, and the
 * host takes its offer back.
 */
export class RelayRenewal {
  private timer?: ReturnType<typeof setInterval>;
  private answerTimeout?: ReturnType<typeof setTimeout>;
  private stopped = false;

  public constructor(
    private readonly connection: RTCPeerConnection,
    private readonly signal: RTCDataChannel,
    /** Fresh relay servers - none without credentials. */
    private readonly fresh: () => Promise<readonly RelayServer[]>,
    /** The local description once its candidates are gathered. */
    private readonly describe: () => Promise<string>
  ) {
    signal.onmessage = ({ data }) => void this.receive(data);
  }

  /** The host's part: renews every {@link RELAY_RENEW_MS} until stopped. */
  public start(): void {
    this.timer ??= setInterval(() => void this.renew(), RELAY_RENEW_MS);
  }

  public stop(): void {
    this.stopped = true;
    clearInterval(this.timer);
    clearTimeout(this.answerTimeout);
  }

  /** One renewal: fresh credentials, an ICE restart and its offer. */
  public async renew(): Promise<void> {
    if (
      this.connection.signalingState !== 'stable' ||
      this.signal.readyState !== 'open'
    ) {
      return;
    }
    try {
      if (!(await this.configure())) {
        return;
      }
      this.connection.restartIce();
      await this.connection.setLocalDescription(
        await this.connection.createOffer()
      );
      this.send({ t: 'offer', sdp: await this.describe() });
      this.answerTimeout = setTimeout(
        () => void this.takeBack(),
        RENEW_ANSWER_TIMEOUT_MS
      );
    } catch (error) {
      console.warn('The relay could not be renewed', error);
    }
  }

  /** Takes fresh credentials - false for none, or once stopped. */
  private async configure(): Promise<boolean> {
    const servers = await this.fresh();
    if (this.stopped || servers.length === 0) {
      return false;
    }
    this.connection.setConfiguration({
      ...this.connection.getConfiguration(),
      iceServers: iceServers(servers),
    });
    return true;
  }

  private async receive(data: unknown): Promise<void> {
    const signal = parseSignal(data);
    if (signal === null || this.stopped) {
      return;
    }
    try {
      if (signal.t === 'offer') {
        // The guest's part. Without fresh credentials of its own it still
        // answers, or the host's restart would never finish.
        await this.configure();
        await this.connection.setRemoteDescription({
          type: 'offer',
          sdp: signal.sdp,
        });
        await this.connection.setLocalDescription(
          await this.connection.createAnswer()
        );
        this.send({ t: 'answer', sdp: await this.describe() });
      } else if (this.connection.signalingState === 'have-local-offer') {
        clearTimeout(this.answerTimeout);
        await this.connection.setRemoteDescription({
          type: 'answer',
          sdp: signal.sdp,
        });
      }
    } catch (error) {
      console.warn('The relay renewal failed', error);
    }
  }

  /** Back to the connection as it was, when the guest never answered. */
  private async takeBack(): Promise<void> {
    if (this.connection.signalingState === 'have-local-offer') {
      await this.connection
        .setLocalDescription({ type: 'rollback' })
        .catch((error: unknown) =>
          console.warn('The relay renewal could not be taken back', error)
        );
    }
  }

  private send(signal: Signal): void {
    if (this.signal.readyState === 'open') {
      this.signal.send(JSON.stringify(signal));
    }
  }
}
