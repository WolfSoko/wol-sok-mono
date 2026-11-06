import { pairedTransport } from './paired-transport';

/** Lets every message under way arrive. */
const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('pairedTransport', () => {
  async function pair() {
    const transport = pairedTransport();
    const host = await transport.offer();
    const guest = await transport.answer(host.offer);
    await host.link.accept(guest.answer);
    return { host: host.link, guest: guest.link };
  }

  it('opens both ends once the host accepts the answer', async () => {
    const { host, guest } = await pair();

    await expect(host.opened).resolves.toBeUndefined();
    await expect(guest.opened).resolves.toBeUndefined();
  });

  it('refuses an answer to an offer it never made', async () => {
    const transport = pairedTransport();
    const host = await transport.offer();

    await expect(transport.answer('elsewhere')).rejects.toThrow();
    await expect(host.link.accept('made-up')).rejects.toThrow();
  });

  it('delivers in order and later, never during the send', async () => {
    const { host, guest } = await pair();
    const received: string[] = [];
    guest.messages$.subscribe((message) => received.push(message));

    host.send('one');
    host.send('two');
    expect(received).toEqual([]);

    await flush();
    expect(received).toEqual(['one', 'two']);
  });

  it('closes the other end too, and sends nothing after', async () => {
    const { host, guest } = await pair();
    const received: string[] = [];
    let guestClosed = false;
    host.messages$.subscribe((message) => received.push(message));
    guest.closed$.subscribe(() => (guestClosed = true));

    host.close();
    guest.send('too late');
    await flush();

    expect(guestClosed).toBe(true);
    expect(received).toEqual([]);
  });

  it('rejects the opening of an end closed before it opened', async () => {
    const transport = pairedTransport();
    const { link } = await transport.offer();

    link.close();

    await expect(link.opened).rejects.toThrow('The connection closed.');
  });
});
