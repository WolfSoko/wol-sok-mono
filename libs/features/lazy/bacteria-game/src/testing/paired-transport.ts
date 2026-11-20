import { Subject } from 'rxjs';
import {
  type PeerConnection,
  type PeerTransport,
  PeerUnreachableError,
  type UnreachableKind,
} from '../lib/net/peer-transport';
import type { RelayServer } from '../lib/storage/game-relay';

/** Lets every message under way arrive, and the promises it settles. */
export const flush = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve));

/** One end of an in-memory connection. */
class PairedEnd implements PeerConnection {
  private readonly incoming = new Subject<string>();
  private readonly ended = new Subject<void>();
  private isOpen = false;
  private isClosed = false;
  private resolveOpened: () => void = () => undefined;
  /** The guest's end and its answer, once the guest answered this host. */
  private guest: { end: PairedEnd; answer: string } | null = null;
  /** The other end, once paired. */
  private other: PairedEnd | null = null;

  public readonly messages$ = this.incoming.asObservable();
  public readonly closed$ = this.ended.asObservable();
  public readonly opened: Promise<void>;

  /** What `opened` rejects with once this end closes before it opened. */
  private closedBy: Error = new Error('The connection closed.');

  public constructor() {
    this.opened = new Promise((resolve, reject) => {
      this.resolveOpened = resolve;
      this.ended.subscribe(() => reject(this.closedBy));
    });
    this.opened.catch(() => undefined);
  }

  /** True once this end closed - the host gave up, say. */
  public get closed(): boolean {
    return this.isClosed;
  }

  /** Pairs this host's end with the guest's, which answered with `answer`. */
  public pair(guest: PairedEnd, answer: string): void {
    this.guest = { end: guest, answer };
    this.other = guest;
    guest.other = this;
  }

  public async accept(answer: string): Promise<void> {
    const guest = this.guest;
    if (guest === null || answer !== guest.answer) {
      throw new Error(`No guest answered with "${answer}".`);
    }
    this.open();
    guest.end.open();
  }

  public send(message: string): void {
    const other = this.other;
    if (!this.isOpen || other === null) {
      return;
    }
    // Later, as over the network: a reply never re-enters the sender.
    queueMicrotask(() => other.receive(message));
  }

  /** Closes this end before it opened, `opened` rejecting with `error`. */
  public failWith(error: Error): void {
    this.closedBy = error;
    this.close();
  }

  public close(): void {
    if (this.isClosed) {
      return;
    }
    this.isClosed = true;
    const wasOpen = this.isOpen;
    this.isOpen = false;
    this.ended.next();
    this.ended.complete();
    this.incoming.complete();
    // The other device notices too - after a moment, as over the network,
    // and a link that failed before it opened failed there alike.
    const other = this.other;
    const error = wasOpen ? null : this.closedBy;
    queueMicrotask(() =>
      error === null ? other?.close() : other?.failWith(error)
    );
  }

  private open(): void {
    if (!this.isClosed) {
      this.isOpen = true;
      this.resolveOpened();
    }
  }

  private receive(message: string): void {
    if (this.isOpen) {
      this.incoming.next(message);
    }
  }
}

/** A {@link PeerTransport} in memory, with the guest's end for a spec. */
export interface PairedTransport extends PeerTransport {
  /** The end of the guest that answered last - to lose its connection. */
  readonly lastGuest: PeerConnection | null;
  /**
   * Lets the next guest's connection fail before it opens: unreachable for
   * a kind, with a plain error for null.
   */
  failNextGuest(kind: UnreachableKind | null): void;
  /** The relay each offer and answer was made with, in order. */
  readonly relays: readonly {
    side: 'host' | 'guest';
    relay: readonly RelayServer[];
  }[];
}

/**
 * Connections in memory, for specs: an offer made on it is answered on it,
 * and once the host accepts the answer both ends open and pass messages
 * to each other, ordered and asynchronous like a data channel. Closing one
 * end closes the other. Give both devices' services the same instance.
 */
export function pairedTransport(): PairedTransport {
  const offers = new Map<string, PairedEnd>();
  let made = 0;
  let lastGuest: PairedEnd | null = null;
  let nextFailure: Error | null = null;
  const relays: { side: 'host' | 'guest'; relay: readonly RelayServer[] }[] =
    [];
  return {
    relays,
    get lastGuest() {
      return lastGuest;
    },
    failNextGuest(kind) {
      nextFailure =
        kind === null
          ? new Error('The connection failed.')
          : new PeerUnreachableError(kind);
    },
    supported: () => true,
    async offer(relay) {
      relays.push({ side: 'host', relay: relay.servers });
      const host = new PairedEnd();
      const offer = `offer-${++made}`;
      offers.set(offer, host);
      return { link: host, offer };
    },
    async answer(offer, relay) {
      relays.push({ side: 'guest', relay: relay.servers });
      const host = offers.get(offer);
      if (host === undefined || host.closed) {
        throw new Error(`No open offer "${offer}".`);
      }
      offers.delete(offer);
      const guest = new PairedEnd();
      const answer = `answer-${++made}`;
      host.pair(guest, answer);
      lastGuest = guest;
      if (nextFailure !== null) {
        guest.failWith(nextFailure);
        nextFailure = null;
      }
      return { link: guest, answer };
    },
  };
}
