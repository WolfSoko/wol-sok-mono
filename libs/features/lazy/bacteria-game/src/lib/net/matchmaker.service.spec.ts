import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FakeGameAccount } from '../../testing/fake-game-account';
import { FakeGameSocial } from '../../testing/fake-game-social';
import { MATCH_LEVELS } from '../state/match-level';
import { GameAccount } from '../storage/game-account';
import { GameCloud } from '../storage/game-cloud';
import { claimable, MatchmakerService } from './matchmaker.service';
import {
  IDLE_LOBBY,
  OnlineLobby,
  OnlineMatchService,
} from './online-match.service';

/** The connection, as far as the matchmaking uses it. */
class FakeOnline {
  public readonly available = true;
  public readonly peer = signal<string | null>(null);
  public readonly lobby = signal<OnlineLobby>(IDLE_LOBBY);
  public readonly join = jest.fn(async () =>
    this.lobby.set({ ...IDLE_LOBBY, phase: 'connecting', role: 'guest' })
  );
  public readonly leave = jest.fn(() => this.lobby.set(IDLE_LOBBY));
  public readonly host = jest.fn(
    (options: { onCode?: (code: string) => void }) => {
      this.lobby.set({ ...IDLE_LOBBY, phase: 'waiting', code: 'ROOM22' });
      options.onCode?.('ROOM22');
      return new Promise<void>(() => undefined);
    }
  );
}

describe('MatchmakerService', () => {
  let social: FakeGameSocial;
  let online: FakeOnline;

  function matchmaker(uid: string): MatchmakerService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAccount, useValue: new FakeGameAccount(uid) },
        {
          provide: GameCloud,
          useValue: {
            social: () => social,
            presence: () => null,
            rooms: () => null,
          },
        },
        { provide: OnlineMatchService, useValue: online },
      ],
    });
    return TestBed.inject(MatchmakerService);
  }

  beforeEach(() => {
    jest.useFakeTimers();
    social = new FakeGameSocial();
    online = new FakeOnline();
  });

  afterEach(() => jest.useRealTimers());

  it('waits in the queue while nobody older waits', async () => {
    const first = matchmaker('ada');

    await first.find();
    await jest.advanceTimersByTimeAsync(3000);

    expect(first.state()).toBe('searching');
    expect(social.get('queue/ada')).toEqual(
      expect.objectContaining({ claim: null })
    );
    expect(online.host).not.toHaveBeenCalled();
  });

  it('leaves the queue again when cancelled while joining it', async () => {
    const first = matchmaker('ada');
    const timers = jest.getTimerCount();

    const finding = first.find();
    const cancelling = first.cancel();
    await Promise.all([finding, cancelling]);

    expect(first.state()).toBe('idle');
    expect(social.get('queue/ada')).toBeNull();
    // No search goes on behind the cancel.
    expect(jest.getTimerCount()).toBe(timers);
  });

  it('claims the older player with a room of its own, and leaves the queue', async () => {
    await social.enqueue('ada');
    const second = matchmaker('bob');

    await second.find();
    await jest.advanceTimersByTimeAsync(0);

    expect(online.host).toHaveBeenCalledWith(
      expect.objectContaining({ auto: true })
    );
    expect(social.get('queue/ada')).toEqual(
      expect.objectContaining({ claim: 'ROOM22' })
    );
    expect(social.get('queue/bob')).toBeNull();
    expect(second.state()).toBe('found');
  });

  it('joins the room a newer player claimed it with', async () => {
    const first = matchmaker('ada');
    await first.find();

    social.put('queue/ada', {
      ...(social.get('queue/ada') as object),
      claim: 'K7QPXM',
    });
    await jest.advanceTimersByTimeAsync(0);

    expect(online.join).toHaveBeenCalledWith('K7QPXM', { auto: true });
    expect(social.get('queue/ada')).toBeNull();
    expect(first.state()).toBe('found');
  });

  it('goes back into the queue when the claimed player never comes', async () => {
    await social.enqueue('ada');
    const second = matchmaker('bob');
    await second.find();
    await jest.advanceTimersByTimeAsync(0);
    social.remove('queue/ada');

    await jest.advanceTimersByTimeAsync(20_000);
    TestBed.tick();
    await jest.advanceTimersByTimeAsync(0);

    expect(online.leave).toHaveBeenCalled();
    expect(second.state()).toBe('searching');
    expect(social.get('queue/bob')).not.toBeNull();
  });

  describe('the level the players would like', () => {
    const [hourglass, corridors] = MATCH_LEVELS.slice(1).map(({ id }) => id);

    it('goes into the queue entry, null for any level', async () => {
      const first = matchmaker('ada');
      await first.find();
      expect(social.get('queue/ada')).toEqual(
        expect.objectContaining({ level: null })
      );

      await first.cancel();
      first.setLevel(hourglass);
      await first.find();
      expect(social.get('queue/ada')).toEqual(
        expect.objectContaining({ level: hourglass })
      );
    });

    it('changes in the queue entry while waiting, keeping the place', async () => {
      const first = matchmaker('ada');
      await first.find();
      const { since } = social.get('queue/ada') as { since: number };

      first.setLevel(hourglass);
      await jest.advanceTimersByTimeAsync(0);

      expect(social.get('queue/ada')).toEqual(
        expect.objectContaining({ since, level: hourglass, claim: null })
      );
      expect(first.state()).toBe('searching');
    });

    it('plays the waiting player’s level, which the claimer keeps', async () => {
      await social.enqueue('ada', hourglass);
      const second = matchmaker('bob');
      second.setLevel(corridors);

      await second.find();
      await jest.advanceTimersByTimeAsync(0);

      expect(social.get('queue/ada')).toEqual(
        expect.objectContaining({
          claim: 'ROOM22',
          picked: { levelId: hourglass, pick: 'waiting' },
        })
      );
      expect(second.matchLevel()).toEqual({
        levelId: hourglass,
        reason: 'theirs',
      });
    });

    it('plays the claimer’s level when the waiting player takes any', async () => {
      await social.enqueue('ada', 'a-level-of-a-newer-build');
      const second = matchmaker('bob');
      second.setLevel(corridors);

      await second.find();
      await jest.advanceTimersByTimeAsync(0);

      expect(second.matchLevel()).toEqual({
        levelId: corridors,
        reason: 'yours',
      });
    });

    it('tells the waiting player the level and whose choice it was', async () => {
      const first = matchmaker('ada');
      first.setLevel(hourglass);
      await first.find();

      social.put('queue/ada', {
        ...(social.get('queue/ada') as object),
        claim: 'K7QPXM',
        picked: { levelId: hourglass, pick: 'waiting' },
      });
      await jest.advanceTimersByTimeAsync(0);

      expect(first.matchLevel()).toEqual({
        levelId: hourglass,
        reason: 'yours',
      });
    });

    it('says nothing about a claim from an older build', async () => {
      const first = matchmaker('ada');
      await first.find();

      social.put('queue/ada', {
        ...(social.get('queue/ada') as object),
        claim: 'K7QPXM',
      });
      await jest.advanceTimersByTimeAsync(0);

      expect(online.join).toHaveBeenCalledWith('K7QPXM', { auto: true });
      expect(first.matchLevel()).toBeNull();
    });
  });

  it('leaves the queue when the player stops looking', async () => {
    const first = matchmaker('ada');
    await first.find();

    await first.cancel();

    expect(first.state()).toBe('idle');
    expect(social.get('queue/ada')).toBeNull();
  });
});

describe('claimable', () => {
  const entry = {
    uid: 'old',
    since: 1000,
    seen: 50_000,
    level: null,
    claim: null,
    picked: null,
  };

  it('takes an older, unclaimed, fresh entry of someone else', () => {
    expect(claimable(entry, 'me', 2000, 60_000)).toBe(true);
    expect(claimable(entry, 'old', 2000, 60_000)).toBe(false);
    expect(claimable({ ...entry, claim: 'ROOM22' }, 'me', 2000, 60_000)).toBe(
      false
    );
    expect(claimable(entry, 'me', 500, 60_000)).toBe(false);
    expect(claimable(entry, 'me', 2000, 100_000)).toBe(false);
  });
});
