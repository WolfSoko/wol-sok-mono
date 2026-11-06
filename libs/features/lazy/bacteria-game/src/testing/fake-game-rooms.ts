import {
  CODE_LENGTH,
  type GameRooms,
  type JoinedRoom,
  type OpenRoom,
  roomCode,
} from '../lib/storage/game-rooms';

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
 * Codes run "AAAAAA", "BBBBBB", … in the order the rooms open.
 */
export class FakeGameRooms implements GameRooms {
  private readonly rooms = new Map<string, FakeRoom>();
  /** Set to make `take` fail, as when the stub cannot be written. */
  public takeFails: Error | null = null;

  public async open(offer: string): Promise<OpenRoom> {
    const code = roomCode(new Uint8Array(CODE_LENGTH).fill(this.rooms.size));
    if (this.rooms.has(code)) {
      throw new Error('The fake runs out of room codes.');
    }
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
    // Closed first: closing a taken room would delete its stub.
    return room.closed ? 'closed' : room.taken ? 'taken' : 'open';
  }
}
