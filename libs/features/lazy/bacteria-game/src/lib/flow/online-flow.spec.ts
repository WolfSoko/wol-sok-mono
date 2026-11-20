import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { MatchmakerService } from '../net/matchmaker.service';
import type { OnlineStart } from '../net/net-message';
import { OnlineEvent, OnlineMatchService } from '../net/online-match.service';
import { FakeOnlineMatch } from '../../testing/fake-online-match';
import { SocialService } from '../social/social.service';
import { STAGE_PROVIDERS } from '../stage-providers';
import { GameStateService } from '../state/game-state.service';
import { GameStateStore } from '../state/game.states';
import { MATCH_LEVELS } from '@wolsok/feat-shared-bacteria-engine';
import { OnlineFlow } from './online-flow';
import { PlayFlow } from './play-flow';

describe('OnlineFlow', () => {
  let online: OnlineFlow;
  let flow: PlayFlow;
  let store: GameStateStore;
  let match: FakeOnlineMatch;

  beforeEach(() => {
    localStorage.clear();
    match = new FakeOnlineMatch();
    TestBed.configureTestingModule({
      providers: [
        STAGE_PROVIDERS,
        { provide: OnlineMatchService, useValue: match },
      ],
    });
    online = TestBed.inject(OnlineFlow);
    flow = TestBed.inject(PlayFlow);
    store = TestBed.inject(GameStateStore);
  });

  describe('a match the matchmaking set up', () => {
    it('is played on the level the matchmaking picked', () => {
      const levelId = MATCH_LEVELS[3].id;
      jest
        .spyOn(TestBed.inject(MatchmakerService), 'matchLevel')
        .mockReturnValue({ levelId, reason: 'theirs' });
      const start = jest
        .spyOn(flow, 'startGame')
        .mockImplementation(() => undefined);

      (
        online as unknown as { startMatchmadeMatch(): void }
      ).startMatchmadeMatch();

      expect(store.snapshot().levelId).toBe(levelId);
      expect(start).toHaveBeenCalled();
    });

    it('waits for the arena to be clear before the host starts it', () => {
      const levelBefore = store.snapshot().levelId;
      const events = match.events;
      const cleared = (flow as unknown as { cleared: Subject<void> }).cleared;
      const start = jest
        .spyOn(flow, 'startGame')
        .mockImplementation(() => undefined);
      online.start();
      flow.resetting.set(true);

      events.next({ type: 'connected', auto: true, seat: 0 } as OnlineEvent);
      expect(start).not.toHaveBeenCalled();
      // The level switches only once the old arena has turned to dust.
      expect(store.snapshot().levelId).toBe(levelBefore);

      store.update({
        online: {
          seat: 0,
          levelId: MATCH_LEVELS[0].id,
          colors: ['orange', 'blue'],
        },
      });
      cleared.next();
      expect(start).toHaveBeenCalledTimes(1);
    });
  });

  describe('the host’s start', () => {
    it('waits for the arena to be clear, then plays it once', () => {
      const events = match.events;
      const cleared = (flow as unknown as { cleared: Subject<void> }).cleared;
      const start = jest
        .spyOn(flow, 'startGame')
        .mockImplementation(() => undefined);
      store.update({
        online: {
          seat: 1,
          levelId: MATCH_LEVELS[0].id,
          colors: ['orange', 'blue'],
        },
      });
      online.start();
      flow.resetting.set(true);

      events.next({ type: 'start', start: {} as OnlineStart });
      expect(start).not.toHaveBeenCalled();

      cleared.next();
      expect(start).toHaveBeenCalledTimes(1);
      cleared.next();
      expect(start).toHaveBeenCalledTimes(1);
    });
  });

  describe('an invitation link', () => {
    const token = 'abcdefghjkmnpqrstuvw';
    let social: SocialService;
    let navigate: jest.SpyInstance;

    beforeEach(() => {
      social = TestBed.inject(SocialService);
      Object.defineProperty(social, 'available', { value: true });
      navigate = jest
        .spyOn(TestBed.inject(Router), 'navigateByUrl')
        .mockResolvedValue(true);
      TestBed.inject(DOCUMENT).location.hash = `#friend=${token}`;
    });

    afterEach(() => (TestBed.inject(DOCUMENT).location.hash = ''));

    function takeInvite(): Promise<void> {
      return (
        online as unknown as { takeInvite(): Promise<void> }
      ).takeInvite();
    }

    it('offers the inviter, and takes the link out of the address', async () => {
      jest.spyOn(social, 'readInvite').mockResolvedValue('Ada');

      await takeInvite();

      expect(online.inviteOffer()).toEqual({ token, from: 'Ada' });
      expect(navigate).toHaveBeenCalled();
    });

    it('leaves an address be that no longer carries the link', async () => {
      jest.spyOn(social, 'readInvite').mockImplementation(async () => {
        TestBed.inject(DOCUMENT).location.hash = '';
        return 'Ada';
      });

      await takeInvite();

      expect(online.inviteOffer()).toEqual({ token, from: 'Ada' });
      expect(navigate).not.toHaveBeenCalled();
    });

    describe('opening the game while it runs', () => {
      const flushLinks = () => new Promise((resolve) => setTimeout(resolve));
      let document: Document;

      beforeEach(() => {
        document = TestBed.inject(DOCUMENT);
        document.location.hash = '';
      });

      /** The fragment changes from outside, as a link into the open app does. */
      function followLink(hash: string): void {
        document.location.hash = hash;
        document.defaultView?.dispatchEvent(new HashChangeEvent('hashchange'));
      }

      it('offers the inviter of a link that arrives later', async () => {
        const read = jest.spyOn(social, 'readInvite').mockResolvedValue('Ada');
        online.start();
        await flushLinks();
        expect(read).not.toHaveBeenCalled();

        followLink(`#friend=${token}`);
        await flushLinks();

        expect(read).toHaveBeenCalledWith(token);
        expect(online.inviteOffer()).toEqual({ token, from: 'Ada' });
        expect(navigate).toHaveBeenCalled();
      });

      it('offers a shared run that arrives later', async () => {
        const offer = jest
          .spyOn(TestBed.inject(GameStateService), 'offerChallenge')
          .mockResolvedValue(true);
        online.start();
        await flushLinks();

        followLink('#run=shared');
        await flushLinks();

        expect(offer).toHaveBeenLastCalledWith('#run=shared');
        expect(navigate).toHaveBeenCalled();
      });

      it('does not take a link again when the game drops it itself', async () => {
        const read = jest.spyOn(social, 'readInvite').mockResolvedValue('Ada');
        navigate.mockImplementation(async () => {
          // As the router does: replaceState, which fires no hashchange.
          history.replaceState(null, '', '/');
          return true;
        });
        online.start();

        followLink(`#friend=${token}`);
        await flushLinks();
        await flushLinks();

        expect(read).toHaveBeenCalledTimes(1);
      });
    });

    it('keeps the link when it could not be read, for a reload', async () => {
      jest.spyOn(social, 'readInvite').mockRejectedValue(new Error('offline'));

      await takeInvite();

      expect(online.inviteOffer()).toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    });
  });
});
