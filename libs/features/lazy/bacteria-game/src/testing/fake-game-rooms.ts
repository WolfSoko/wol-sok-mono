import type {
  GameRooms,
  JoinedRoom,
  OpenRoom,
} from '../lib/storage/game-rooms';

/** Letters a room code may end in, as `normalizeRoomCode` takes them. */
const CODE_ENDINGS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** A room as the fake keeps it. */
interface FakeRoom {
  offer: string;
  answered: boolean;
  closed: boolean;
  taken: boolean;
  answerWith: (answer: string) => void;
}

/**
 * Rooms in memory, for specs: the host's offer reaches the guest who
 * joins with the code, the guest's answer reaches the host. One fake
 * stands for the project, so two devices' services can meet through it.
 * Codes run "K7QPXA", "K7QPXB", … in the order the rooms open.
 */
export class FakeGameRooms implements GameRooms {
  private readonly rooms = new Map<string, FakeRoom>();
  /** Set to make `take` fail, as when the stub cannot be written. */
  public takeFails: Error | null = null;

  public async open(offer: string): Promise<OpenRoom> {
    const code = `K7QPX${CODE_ENDINGS[this.rooms.size]}`;
    let answerWith: (answer: string) => void = () => undefined;
    const answer = new Promise<string>((resolve) => {
      answerWith = resolve;
    });
    const room: FakeRoom = {
      offer,
      answered: false,
      closed: false,
      taken: false,
      answerWith,
    };
    this.rooms.set(code, room);
    return {
      code,
      answer,
      close: () => {
        room.closed = true;
      },
      take: async () => {
        if (this.takeFails !== null) {
          throw this.takeFails;
        }
        room.taken = true;
      },
    };
  }

  public async join(code: string): Promise<JoinedRoom | null> {
    const room = this.rooms.get(code);
    if (room === undefined || room.closed || room.taken) {
      return null;
    }
    return {
      offer: room.offer,
      answer: async (answer) => {
        if (room.answered) {
          // The rules let only the first guest answer.
          throw Object.assign(new Error('Room taken.'), {
            code: 'permission-denied',
          });
        }
        room.answered = true;
        room.answerWith(answer);
      },
    };
  }

  /** Where the room under `code` stands, for the spec to check. */
  public state(code: string): 'open' | 'closed' | 'taken' | undefined {
    const room = this.rooms.get(code);
    if (room === undefined) {
      return undefined;
    }
    return room.taken ? 'taken' : room.closed ? 'closed' : 'open';
  }
}
