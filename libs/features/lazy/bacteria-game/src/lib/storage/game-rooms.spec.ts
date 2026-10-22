import { CODE_LENGTH, normalizeRoomCode, roomCode } from './game-rooms';

describe('room codes', () => {
  it('are six letters and digits that do not read like another', () => {
    const code = roomCode();

    expect(code).toHaveLength(CODE_LENGTH);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(roomCode(() => 0)).toBe('AAAAAA');
  });

  it('are read as typed, in any case, with spaces and dashes', () => {
    expect(normalizeRoomCode(' k7q-pxm ')).toBe('K7QPXM');
    expect(normalizeRoomCode('K7QPX')).toBeNull();
    expect(normalizeRoomCode('K7QPX0')).toBeNull();
  });
});
