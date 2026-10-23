import { TestBed } from '@angular/core/testing';
import { firstValueFrom, take, toArray } from 'rxjs';
import { FakeGameAccount } from '../../testing/fake-game-account';
import {
  FakeGamePresence,
  FakeGameSocial,
} from '../../testing/fake-game-social';
import { GameAccount } from '../storage/game-account';
import { GameCloud } from '../storage/game-cloud';
import { GameState, GameStateStore } from '../state/game.states';
import { defaultProfile } from './profile';
import { SocialService } from './social.service';

describe('SocialService', () => {
  let social: FakeGameSocial;
  let presence: FakeGamePresence;
  let account: FakeGameAccount;

  function service(): SocialService {
    return TestBed.inject(SocialService);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    social = new FakeGameSocial();
    presence = new FakeGamePresence();
    account = new FakeGameAccount('ada');
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAccount, useValue: account },
        {
          provide: GameCloud,
          useValue: {
            social: () => social,
            presence: () => presence,
            rooms: () => null,
          },
        },
      ],
    });
  });

  it('makes a profile up until one is stored, then shows the stored one', async () => {
    const players = service();
    expect(players.profile()).toEqual(defaultProfile('ada'));

    await players.saveProfile({ ...defaultProfile('ada'), name: 'Ada' });
    TestBed.tick();

    expect(players.profile()?.name).toBe('Ada');
  });

  it('lists friends, mutual or not, with who is online', async () => {
    const players = service();
    await social.saveProfile('bob', { ...defaultProfile('bob'), name: 'Bob' });
    await players.addFriend('bob');
    TestBed.tick();
    expect(players.friends()).toEqual([
      expect.objectContaining({ uid: 'bob', mutual: false, status: null }),
    ]);
    expect(social.get('players/bob/requests/ada')).not.toBeNull();

    await social.acceptRequest('bob', 'ada');
    presence.set('bob', 'online');
    TestBed.tick();

    expect(players.friends()).toEqual([
      {
        uid: 'bob',
        card: expect.objectContaining({ name: 'Bob' }),
        mutual: true,
        status: 'online',
      },
    ]);
  });

  it('answers requests and challenges', async () => {
    const players = service();
    await social.sendRequest('cyd', 'ada');
    await social.challenge('cyd', 'ada', 'K7QPXM');
    TestBed.tick();
    expect(players.requests().map(({ uid }) => uid)).toEqual(['cyd']);
    expect(players.challenges()).toEqual([
      expect.objectContaining({ uid: 'cyd', code: 'K7QPXM' }),
    ]);

    await players.acceptRequest('cyd');
    await players.clearChallenge('cyd');
    TestBed.tick();

    expect(players.requests()).toEqual([]);
    expect(players.challenges()).toEqual([]);
    expect(social.get('players/ada/friends/cyd')).not.toBeNull();
  });

  it('makes friends by an invitation link', async () => {
    const players = service();
    const token = await social.createInvite('dan');

    expect(await players.readInvite(token)).toBe('dan');
    await players.acceptInvite(token, 'dan');

    expect(social.get('players/ada/friends/dan')).not.toBeNull();
    expect(social.get('players/dan/friends/ada')).not.toBeNull();
    expect(await players.inviteLink('https://game.test/#old')).toMatch(
      /^https:\/\/game\.test\/#friend=token/
    );
  });

  it('shows the player online while they share it, playing in an online match', async () => {
    const players = service();
    TestBed.tick();
    expect(presence.stateOf('ada')).toBe('online');

    TestBed.inject(GameStateStore).update({
      online: { seat: 0, levelId: 'petri-dish', colors: ['orange', 'blue'] },
      currentState: GameState.RUNNING,
    });
    TestBed.tick();
    expect(presence.stateOf('ada')).toBe('playing');

    await players.saveProfile({ ...defaultProfile('ada'), shareStatus: false });
    TestBed.tick();
    expect(presence.stateOf('ada')).toBeNull();
  });

  it('shows nothing before the stored profile says whether to share', async () => {
    await social.saveProfile('ada', {
      ...defaultProfile('ada'),
      shareStatus: false,
    });
    const set = jest.spyOn(presence, 'set');

    service();
    TestBed.tick();

    expect(set).not.toHaveBeenCalledWith('ada', 'online');
    expect(presence.stateOf('ada')).toBeNull();
  });

  it('reads a card once, however often it is asked for', async () => {
    const players = service();
    await social.saveProfile('eve', { ...defaultProfile('eve'), name: 'Eve' });

    expect(players.card('eve')).toBe(players.card('eve'));
    const cards = await firstValueFrom(
      players.card('eve').pipe(take(2), toArray())
    );
    expect(cards.at(-1)?.name).toBe('Eve');
  });
});
