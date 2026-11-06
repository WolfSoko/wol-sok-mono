import { createEnvironmentInjector, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Ruleset } from '@wolsok/feat-shared-bacteria-engine';
import { FakeGameAccount } from '../../testing/fake-game-account';
import { FakeGameRooms } from '../../testing/fake-game-rooms';
import {
  pairedTransport,
  type PairedTransport,
} from '../../testing/paired-transport';
import { PlayerService } from '../state/player.service';
import { GameAccount } from '../storage/game-account';
import { provideFakeGameCloud } from '../../testing/fake-game-cloud';
import type { OnlineSetup, OnlineStart } from './net-message';
import { NET_VERSION } from './net-message';
import { OnlineEvent, OnlineMatchService } from './online-match.service';
import { PeerTransport } from './peer-transport';

/** Lets every message and promise under way settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve));

const SETUP: OnlineSetup = {
  levelId: 'petri-dish',
  colors: ['orange', 'blue'],
};
const START: OnlineStart = { ...SETUP, seed: 42, ruleset: 'cpu' };

/** One device: its own service, account and offers, on the shared network. */
interface Device {
  online: OnlineMatchService;
  events: OnlineEvent[];
}

describe('OnlineMatchService between two devices', () => {
  let rooms: FakeGameRooms;
  let transport: PairedTransport;

  beforeEach(() => {
    rooms = new FakeGameRooms();
    transport = pairedTransport();
    TestBed.configureTestingModule({
      providers: [
        provideFakeGameCloud({ rooms }),
        { provide: PeerTransport, useValue: transport },
      ],
    });
  });

  function device(uid: string, offers: readonly Ruleset[] = ['cpu']): Device {
    const injector = createEnvironmentInjector(
      [
        OnlineMatchService,
        { provide: GameAccount, useValue: new FakeGameAccount(uid) },
        { provide: PlayerService, useValue: { rulesetOffers: () => offers } },
      ],
      TestBed.inject(EnvironmentInjector)
    );
    const online = injector.get(OnlineMatchService);
    const events: OnlineEvent[] = [];
    online.events$.subscribe((event) => events.push(event));
    return { online, events };
  }

  /** Ada hosts, Bob joins with her code; both said hello. */
  async function connected(
    offers: { host?: readonly Ruleset[]; guest?: readonly Ruleset[] } = {}
  ): Promise<{ host: Device; guest: Device; code: string }> {
    const host = device('ada', offers.host);
    const guest = device('bob', offers.guest);
    const hosting = host.online.host();
    await flush();
    const code = host.online.lobby().code ?? '';
    await guest.online.join(code);
    await hosting;
    await flush();
    return { host, guest, code };
  }

  describe('connecting', () => {
    it('waits in a room under a code until a guest joins', async () => {
      const host = device('ada');
      const codes: string[] = [];

      void host.online.host({ onCode: (code) => codes.push(code) });
      await flush();

      expect(host.online.lobby()).toEqual(
        expect.objectContaining({ phase: 'waiting', role: 'host' })
      );
      expect(codes).toEqual([host.online.lobby().code]);
    });

    it('greets each other and gives each device its seat', async () => {
      const { host, guest } = await connected();

      expect(host.online.lobby().phase).toBe('connected');
      expect(guest.online.lobby().phase).toBe('connected');
      expect(host.events).toEqual([
        { type: 'connected', seat: 0, auto: false },
      ]);
      expect(guest.events).toEqual([
        { type: 'connected', seat: 1, auto: false },
      ]);
      expect(host.online.peer()).toBe('bob');
      expect(guest.online.peer()).toBe('ada');
    });

    it('takes the room for its stub once the guest connected, never deleting it', async () => {
      const { host, code } = await connected();

      expect(rooms.state(code)).toBe('taken');

      // Leaving afterwards leaves the stub to its TTL.
      host.online.leave();
      expect(rooms.state(code)).toBe('taken');
    });

    it('plays on when the stub cannot be written', async () => {
      const warn = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      rooms.takeFails = new Error('offline');

      const { host } = await connected();

      expect(host.online.lobby()).toEqual(
        expect.objectContaining({ phase: 'connected', notice: null })
      );
      expect(warn).toHaveBeenCalledWith(
        'The room could not be taken',
        expect.any(Error)
      );
      warn.mockRestore();
    });

    it('deletes a room nobody joined when the host leaves', async () => {
      const host = device('ada');
      void host.online.host();
      await flush();
      const code = host.online.lobby().code ?? '';

      host.online.leave();

      expect(rooms.state(code)).toBe('closed');
    });

    it('tells a guest when no room has the code', async () => {
      const guest = device('bob');

      await guest.online.join('ZZZZZZ');

      expect(guest.online.lobby().notice).toEqual({
        key: 'online.notices.noRoom',
      });
    });
  });

  describe('the setup', () => {
    it("brings the host's setup to the guest", async () => {
      const { host, guest } = await connected();

      host.online.share(SETUP);
      await flush();

      expect(guest.events).toContainEqual({ type: 'setup', setup: SETUP });
    });

    it("brings the guest's colours to the host", async () => {
      const { host, guest } = await connected();

      guest.online.offerColors(['green', 'pink']);
      await flush();

      expect(host.events).toContainEqual({
        type: 'colors',
        colors: ['green', 'pink'],
      });
    });

    it('sends neither the other way round', async () => {
      const { host, guest } = await connected();

      guest.online.share(SETUP);
      host.online.offerColors(['green', 'pink']);
      await flush();

      expect(host.events.map(({ type }) => type)).toEqual(['connected']);
      expect(guest.events.map(({ type }) => type)).toEqual(['connected']);
    });
  });

  describe('a match', () => {
    it('starts on both devices, numbered for the room', async () => {
      const { host, guest, code } = await connected();

      const lockstep = host.online.startMatch(START);
      await flush();

      expect(lockstep?.localSeat).toBe(0);
      expect(guest.events).toContainEqual({ type: 'start', start: START });
      const taken = guest.online.takeStart();
      expect(taken?.start).toEqual(START);
      expect(taken?.lockstep.localSeat).toBe(1);
      expect(guest.online.takeStart()).toBeNull();
      expect(host.online.matchRef()).toEqual({ roomCode: code, n: 1 });
      expect(guest.online.matchRef()).toEqual({ roomCode: code, n: 1 });
    });

    it('is only started by the host, once connected', async () => {
      const lonely = device('ada');
      expect(lonely.online.startMatch(START)).toBeNull();

      const { guest } = await connected();
      expect(guest.online.startMatch(START)).toBeNull();
    });

    it('plays the inputs and checksums of both seats in lockstep', async () => {
      const { host, guest } = await connected();
      const hostSteps = host.online.startMatch(START);
      await flush();
      const guestSteps = guest.online.takeStart()?.lockstep;
      if (hostSteps === null || guestSteps === undefined) {
        throw new Error('The match did not start.');
      }
      const due = hostSteps.delay;

      hostSteps.putLocal(0, { x: 1, y: 0 }, null, false);
      await flush();
      expect(guestSteps.ready(due)).toBe(false);

      guestSteps.putLocal(0, { x: 0, y: 1 }, null, true);
      await flush();
      expect(hostSteps.ready(due)).toBe(true);
      expect(guestSteps.ready(due)).toBe(true);

      hostSteps.ticked(60, []);
      guestSteps.ticked(60, []);
      await flush();
      expect(hostSteps.desynced).toBe(false);
      expect(guestSteps.desynced).toBe(false);
    });

    it('agrees on gpu-int only when both devices offer it', async () => {
      const both = await connected({
        host: ['cpu', 'gpu-int'],
        guest: ['cpu', 'gpu-int'],
      });
      expect(both.host.online.agreedRuleset()).toBe('gpu-int');
      expect(both.guest.online.agreedRuleset()).toBe('gpu-int');

      const one = await connected({ host: ['cpu', 'gpu-int'] });
      expect(one.host.online.agreedRuleset()).toBe('cpu');
    });

    it('ends when the host starts on a ruleset the guest did not offer', async () => {
      const { host, guest } = await connected();

      host.online.startMatch({ ...START, ruleset: 'gpu-int' });
      await flush();

      expect(guest.online.lobby().notice).toEqual({
        key: 'online.notices.otherVersion',
      });
      expect(guest.events).toContainEqual({ type: 'ended', reason: 'lost' });
    });
  });

  describe('ending', () => {
    it('tells the other device when one leaves', async () => {
      const { host, guest } = await connected();

      guest.online.leave();
      await flush();

      expect(host.online.lobby()).toEqual(
        expect.objectContaining({
          phase: 'idle',
          notice: { key: 'online.notices.opponentLeft' },
        })
      );
      expect(host.events).toContainEqual({ type: 'ended', reason: 'left' });
      expect(guest.events).toContainEqual({ type: 'ended', reason: 'left' });
    });

    it('tells the player when the connection is lost', async () => {
      const { host } = await connected();

      transport.ends[1].close();
      await flush();

      expect(host.online.lobby().notice).toEqual({
        key: 'online.notices.lost',
      });
      expect(host.events).toContainEqual({ type: 'ended', reason: 'lost' });
    });

    it('ends with a device of another version', async () => {
      const host = device('ada');
      void host.online.host();
      await flush();
      // A guest of another version, playing the protocol by hand.
      const { link, answer } = await transport.answer('offer-1');
      await rooms
        .join(host.online.lobby().code ?? '')
        .then((room) => room?.answer(answer));
      await link.opened;
      link.send(
        JSON.stringify({
          k: 'hello',
          v: `${NET_VERSION}-old`,
          id: 'eve',
          r: ['cpu'],
        })
      );
      await flush();

      expect(host.online.lobby().notice).toEqual({
        key: 'online.notices.otherVersion',
      });
    });
  });
});
