import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { FakeGameAccount } from '../../testing/fake-game-account';
import { PlayerService } from '../state/player.service';
import { GameAccount } from '../storage/game-account';
import { GameCloud } from '../storage/game-cloud';
import type { GameRooms, OpenRoom } from '../storage/game-rooms';
import { OnlineMatchService } from './online-match.service';

/** A link that opens once the test says so. */
class FakeLink {
  public readonly messages$ = new Subject<string>();
  public readonly closed$ = new Subject<void>();
  public readonly sent: string[] = [];
  public open: () => void = () => undefined;
  public readonly opened = new Promise<void>((resolve) => {
    this.open = resolve;
  });
  public readonly accept = jest.fn(async () => undefined);
  public readonly close = jest.fn();
  public send(message: string): void {
    this.sent.push(message);
  }
}

let mockLink: FakeLink;

/** Lets every promise under way settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve));

jest.mock('./peer-link', () => ({
  PeerLink: {
    supported: () => true,
    offer: async () => ({ link: mockLink, offer: 'offer' }),
    answer: async () => ({ link: mockLink, answer: 'answer' }),
  },
}));

/** A room whose guest answers when the test says so. */
function fakeRoom(): OpenRoom & {
  answerWith: (answer: string) => void;
  close: jest.Mock;
  take: jest.Mock;
} {
  let answerWith: (answer: string) => void = () => undefined;
  const answer = new Promise<string>((resolve) => {
    answerWith = resolve;
  });
  return {
    code: 'K7QPXM',
    answer,
    answerWith,
    close: jest.fn(),
    take: jest.fn(async () => undefined),
  };
}

describe('OnlineMatchService', () => {
  let room: ReturnType<typeof fakeRoom>;
  let rooms: GameRooms;

  function service(): OnlineMatchService {
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAccount, useValue: new FakeGameAccount('ada') },
        { provide: GameCloud, useValue: { rooms: () => rooms } },
        { provide: PlayerService, useValue: { rulesetOffers: () => ['cpu'] } },
      ],
    });
    return TestBed.inject(OnlineMatchService);
  }

  beforeEach(() => {
    mockLink = new FakeLink();
    room = fakeRoom();
    rooms = {
      open: jest.fn(async () => room),
      join: jest.fn(async () => null),
    };
  });

  it('takes the room for its stub once the guest connected, never deleting it', async () => {
    const online = service();
    const hosting = online.host();
    await flush();
    expect(online.lobby().phase).toBe('waiting');

    room.answerWith('answer');
    mockLink.open();
    await hosting;

    expect(mockLink.accept).toHaveBeenCalledWith('answer');
    expect(room.take).toHaveBeenCalledTimes(1);
    expect(room.close).not.toHaveBeenCalled();

    // Leaving afterwards leaves the stub to its TTL.
    online.leave();
    expect(room.close).not.toHaveBeenCalled();
  });

  it('plays on when the stub cannot be written', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    room.take.mockRejectedValue(new Error('offline'));
    const online = service();
    const hosting = online.host();
    await flush();

    room.answerWith('answer');
    mockLink.open();
    await hosting;
    await flush();

    expect(online.lobby().notice).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      'The room could not be taken',
      expect.any(Error)
    );
    warn.mockRestore();
  });

  it('deletes a room nobody joined when the host leaves', async () => {
    const online = service();
    void online.host();
    await flush();

    online.leave();

    expect(room.close).toHaveBeenCalledTimes(1);
    expect(room.take).not.toHaveBeenCalled();
  });
});
