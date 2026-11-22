import { BehaviorSubject } from 'rxjs';
import {
  FakeFirebase,
  settleSnapshots as settle,
} from '../../testing/fake-firebase-sdk';
import {
  FirestoreGamePlayGames,
  PLAY_GAMES_ANSWER_MS,
} from './firestore-game-play-games';

describe('FirestoreGamePlayGames', () => {
  let fake: FakeFirebase;
  let players: BehaviorSubject<string | null>;
  let playGames: FirestoreGamePlayGames;

  beforeEach(() => {
    fake = new FakeFirebase();
    players = new BehaviorSubject<string | null>('guest-1');
    playGames = new FirestoreGamePlayGames(fake.connection(), players);
  });

  /** The functions answer the one sign-in written so far. */
  async function answer(fields: Record<string, unknown>): Promise<string> {
    await settle();
    const [path] = Array.from(fake.docs.keys()).filter((key) =>
      key.startsWith('playGamesSignIns/')
    );
    fake.put(path, { ...fake.docs.get(path), ...fields });
    return path;
  }

  it('sends the code in the player’s name and answers the token', async () => {
    const signedIn = playGames.signIn('4/0Ab');
    const path = await answer({
      result: { ok: true },
      token: 'tok',
      tokenUid: 'guest-1',
    });

    expect(await signedIn).toEqual({
      ok: true,
      token: { value: 'tok', uid: 'guest-1' },
      writer: 'guest-1',
    });
    expect(fake.writes[0]).toMatchObject({
      path,
      data: { uid: 'guest-1', code: '4/0Ab' },
    });
    // It held a token: gone once read.
    expect(fake.deleted()).toEqual([path]);
  });

  it('answers a refusal without a token', async () => {
    const signedIn = playGames.signIn('used');
    await answer({ result: { ok: false, error: 'play-games-refused' } });

    expect(await signedIn).toEqual({
      ok: false,
      error: 'play-games-refused',
      token: null,
      writer: 'guest-1',
    });
  });

  it('waits for the first player', async () => {
    players.next(null);
    const signedIn = playGames.signIn('code');
    await settle();
    expect(fake.writes).toEqual([]);

    players.next('guest-2');
    await answer({ result: { ok: true }, token: 't', tokenUid: 'guest-2' });
    expect(await signedIn).toEqual({
      ok: true,
      token: { value: 't', uid: 'guest-2' },
      writer: 'guest-2',
    });
    expect(fake.writes[0]).toMatchObject({ data: { uid: 'guest-2' } });
  });

  it('gives up when no answer comes in time', async () => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const signedIn = playGames.signIn('code');
    await jest.advanceTimersByTimeAsync(PLAY_GAMES_ANSWER_MS + 1);

    expect(await signedIn).toBeNull();
    // Unanswered, it goes all the same: it holds the code.
    expect(fake.deleted()).toHaveLength(1);
    jest.useRealTimers();
  });

  it('gives up on a write an offline device holds back', async () => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest
      .spyOn(fake.dbSdk, 'setDoc')
      .mockImplementation(() => new Promise<void>(() => undefined));
    const signedIn = playGames.signIn('code');
    await jest.advanceTimersByTimeAsync(PLAY_GAMES_ANSWER_MS + 1);

    expect(await signedIn).toBeNull();
    jest.useRealTimers();
  });
});
