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

/**
 * When the host tries once more after a renewal that did not get through -
 * long before the credentials of the link run out (20 minutes left at
 * least when handed out), not so often that a device of an older version
 * is offered a restart all the time.
 */
export const RENEW_RETRY_MS = 2 * 60_000;

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
  private retryTimeout?: ReturnType<typeof setTimeout>;
  /** True once the renewal of this round failed and was tried again. */
  private retried = false;
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
    this.timer ??= setInterval(() => {
      this.retried = false;
      void this.renew();
    }, RELAY_RENEW_MS);
  }

  public stop(): void {
    this.stopped = true;
    clearInterval(this.timer);
    clearTimeout(this.answerTimeout);
    clearTimeout(this.retryTimeout);
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
        () => void this.failed(),
        RENEW_ANSWER_TIMEOUT_MS
      );
    } catch (error) {
      console.warn('The relay could not be renewed', error);
      await this.failed();
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
    if (signal.t === 'offer') {
      await this.answer(signal.sdp);
    } else if (this.connection.signalingState === 'have-local-offer') {
      try {
        await this.connection.setRemoteDescription({
          type: 'answer',
          sdp: signal.sdp,
        });
        clearTimeout(this.answerTimeout);
        this.retried = false;
      } catch (error) {
        console.warn('The relay renewal was answered wrong', error);
        await this.failed();
      }
    }
  }

  /**
   * The guest's part. Without fresh credentials of its own it still
   * answers, or the host's restart would never finish.
   */
  private async answer(offer: string): Promise<void> {
    try {
      await this.configure();
      await this.connection.setRemoteDescription({ type: 'offer', sdp: offer });
      await this.connection.setLocalDescription(
        await this.connection.createAnswer()
      );
      this.send({ t: 'answer', sdp: await this.describe() });
    } catch (error) {
      console.warn('The relay renewal could not be answered', error);
      await this.takeBack();
    }
  }

  /**
   * A renewal that did not get through - unanswered, answered wrong, or
   * failed on the way: back to the connection as it was, and once more
   * after {@link RENEW_RETRY_MS}.
   */
  private async failed(): Promise<void> {
    clearTimeout(this.answerTimeout);
    await this.takeBack();
    if (!this.retried && !this.stopped) {
      this.retried = true;
      this.retryTimeout = setTimeout(() => void this.renew(), RENEW_RETRY_MS);
    }
  }

  /** Back to the connection as it was, from an offer of either side. */
  private async takeBack(): Promise<void> {
    const state = this.connection.signalingState;
    if (state === 'have-local-offer' || state === 'have-remote-offer') {
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
