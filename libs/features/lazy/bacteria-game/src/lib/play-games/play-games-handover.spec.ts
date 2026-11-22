import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SignIn } from '../guest/sign-in.service';
import { GameCloud } from '../storage/game-cloud';
import type {
  GamePlayGames,
  PlayGamesAnswer,
} from '../storage/game-play-games';
import { PlayGamesHandover } from './play-games-handover';

describe('PlayGamesHandover', () => {
  let hash: string;
  let answer: PlayGamesAnswer | null;
  let playGames: GamePlayGames & { signIn: jest.Mock };
  let cloudPlayGames: GamePlayGames | null;
  let signInWithToken: jest.Mock;
  let navigateByUrl: jest.Mock;

  beforeEach(() => {
    hash = '#play-games=4%2F0Ab';
    answer = {
      ok: true,
      token: { value: 'tok', uid: 'guest-1' },
      writer: 'guest-1',
    };
    playGames = { signIn: jest.fn(async () => answer) };
    cloudPlayGames = playGames;
    signInWithToken = jest.fn(async () => undefined);
    navigateByUrl = jest.fn(async () => {
      hash = '';
      return true;
    });
    const view = new EventTarget();
    TestBed.configureTestingModule({
      providers: [
        PlayGamesHandover,
        {
          provide: DOCUMENT,
          useValue: {
            get location() {
              return { hash };
            },
            defaultView: view,
          },
        },
        {
          provide: Router,
          useValue: { url: '/?source=twa#play-games=x', navigateByUrl },
        },
        { provide: GameCloud, useValue: { playGames: () => cloudPlayGames } },
        { provide: SignIn, useValue: { signInWithToken } },
      ],
    });
  });

  const start = async () => {
    TestBed.inject(PlayGamesHandover).start();
    await new Promise((resolve) => setTimeout(resolve));
  };

  it('takes the code out of the address and signs in with the answer', async () => {
    await start();

    expect(navigateByUrl).toHaveBeenCalledWith('/?source=twa', {
      replaceUrl: true,
    });
    expect(playGames.signIn).toHaveBeenCalledWith('4/0Ab');
    expect(signInWithToken).toHaveBeenCalledWith(
      { value: 'tok', uid: 'guest-1' },
      'guest-1'
    );
  });

  it('does nothing without a code', async () => {
    hash = '#friend=abcdefghij2345678912';
    await start();

    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(playGames.signIn).not.toHaveBeenCalled();
  });

  it('signs in with nothing when the functions refuse or never answer', async () => {
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    answer = {
      ok: false,
      error: 'linked-elsewhere',
      token: null,
      writer: 'guest-1',
    };
    await start();
    expect(signInWithToken).not.toHaveBeenCalled();

    answer = null;
    hash = '#play-games=next';
    await start();
    expect(signInWithToken).not.toHaveBeenCalled();
  });

  it('still drops the code without a project', async () => {
    cloudPlayGames = null;
    await start();

    expect(navigateByUrl).toHaveBeenCalled();
    expect(signInWithToken).not.toHaveBeenCalled();
  });

  it('sends a code that came while another was on its way, should that one fail', async () => {
    let first!: (value: PlayGamesAnswer | null) => void;
    playGames.signIn
      .mockImplementationOnce(
        () =>
          new Promise<PlayGamesAnswer | null>((resolve) => (first = resolve))
      )
      .mockImplementationOnce(async () => answer);
    await start();
    hash = '#play-games=second';
    TestBed.inject(DOCUMENT).defaultView?.dispatchEvent(
      new Event('hashchange')
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(playGames.signIn).toHaveBeenCalledTimes(1);

    first(null);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(playGames.signIn).toHaveBeenLastCalledWith('second');
    expect(signInWithToken).toHaveBeenCalledWith(
      { value: 'tok', uid: 'guest-1' },
      'guest-1'
    );
  });

  it('takes the code of a later start of the running game', async () => {
    hash = '';
    await start();
    hash = '#play-games=later';
    TestBed.inject(DOCUMENT).defaultView?.dispatchEvent(
      new Event('hashchange')
    );
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(playGames.signIn).toHaveBeenCalledWith('later');
  });
});
