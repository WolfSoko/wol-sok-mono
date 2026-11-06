import { Subject } from 'rxjs';
import type { PeerConnection, PeerTransport } from '../lib/net/peer-transport';

/** One end of an in-memory connection. */
class PairedEnd implements PeerConnection {
  private readonly incoming = new Subject<string>();
  private readonly ended = new Subject<void>();
  private isOpen = false;
  private closed = false;
  private resolveOpened: () => void = () => undefined;
  /** The other end, once the guest answered. */
  public other: PairedEnd | null = null;
  /** The guest's answer this end, as the host's, waits for. */
  public expectedAnswer: string | null = null;

  public readonly messages$ = this.incoming.asObservable();
  public readonly closed$ = this.ended.asObservable();
  public readonly opened: Promise<void>;

  public constructor() {
    this.opened = new Promise((resolve, reject) => {
      this.resolveOpened = resolve;
      this.ended.subscribe(() => reject(new Error('The connection closed.')));
    });
    this.opened.catch(() => undefined);
  }

  /** True once this end closed - the host gave up, say. */
  public get gone(): boolean {
    return this.closed;
  }

  public async accept(answer: string): Promise<void> {
    const other = this.other;
    if (other === null || answer !== this.expectedAnswer) {
      throw new Error(`No guest answered with "${answer}".`);
    }
    this.open();
    other.open();
  }

  public send(message: string): void {
    const other = this.other;
    if (!this.isOpen || other === null) {
      return;
    }
    // Later, as over the network: a reply never re-enters the sender.
    queueMicrotask(() => other.receive(message));
  }

  public close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.isOpen = false;
    this.ended.next();
    this.ended.complete();
    this.incoming.complete();
    // The other device notices too - after a moment, as over the network.
    const other = this.other;
    queueMicrotask(() => other?.close());
  }

  private open(): void {
    if (!this.closed) {
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

/** A {@link PeerTransport} in memory, with the ends it made for a spec. */
export interface PairedTransport extends PeerTransport {
  /** Every end made so far, the host's and the guest's, in that order. */
  readonly ends: readonly PeerConnection[];
}

/**
 * Connections in memory, for specs: an offer made on it is answered on it,
 * and once the host accepts the answer both ends open and pass messages
 * to each other, ordered and asynchronous like a data channel. Closing one
 * end closes the other. Give both devices' services the same instance.
 */
export function pairedTransport(): PairedTransport {
  const offers = new Map<string, PairedEnd>();
  const ends: PairedEnd[] = [];
  let made = 0;
  return {
    ends,
    supported: () => true,
    async offer() {
      const host = new PairedEnd();
      const offer = `offer-${++made}`;
      offers.set(offer, host);
      ends.push(host);
      return { link: host, offer };
    },
    async answer(offer: string) {
      const host = offers.get(offer);
      if (host === undefined || host.gone) {
        throw new Error(`No open offer "${offer}".`);
      }
      offers.delete(offer);
      const guest = new PairedEnd();
      const answer = `answer-${++made}`;
      host.other = guest;
      host.expectedAnswer = answer;
      guest.other = host;
      ends.push(guest);
      return { link: guest, answer };
    },
  };
}
