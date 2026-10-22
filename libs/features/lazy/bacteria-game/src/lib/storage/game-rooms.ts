/** A room this device opened, waiting for a guest. */
export interface OpenRoom {
  /** What the guest types in to join. */
  code: string;
  /** The guest's answer to the offer, once one has joined. */
  answer: Promise<string>;
  /** Gives the room up - a guest can no longer join. */
  close(): void;
}

/** A room this device joins. */
export interface JoinedRoom {
  /** The host's offer. */
  offer: string;
  /** Hands the host the answer to its offer. */
  answer(answer: string): Promise<void>;
}

/**
 * Where two devices find each other for an online match: the host opens a
 * room under a short code with its connection offer, the guest joins with
 * the code and leaves its answer. From then on the devices talk directly.
 * Only with the game's Firebase project - see `GameCloud.rooms`.
 */
export interface GameRooms {
  open(offer: string): Promise<OpenRoom>;
  /** The room under `code`, null when there is none or it is taken. */
  join(code: string): Promise<JoinedRoom | null>;
}

/** The letters of a room code - none that read like another. */
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

/** A fresh room code, "K7QPXM". */
export function roomCode(random: () => number = secureRandom): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_LETTERS[Math.floor(random() * CODE_LETTERS.length)];
  }
  return code;
}

/**
 * What a player typed in as a code, cleaned up - upper case, without
 * spaces and dashes - null when it cannot be one.
 */
export function normalizeRoomCode(typed: string): string | null {
  const code = typed.toUpperCase().replace(/[\s-]/g, '');
  return new RegExp(`^[${CODE_LETTERS}]{${CODE_LENGTH}}$`).test(code)
    ? code
    : null;
}

function secureRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}
