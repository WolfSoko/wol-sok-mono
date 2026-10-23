import { inviteToken } from './firestore-game-social';

describe('inviteToken', () => {
  it('is twenty letters and digits, a letter per byte', () => {
    expect(inviteToken()).toMatch(/^[a-z2-9]{20}$/);
    expect(inviteToken(new Uint8Array(20))).toBe('a'.repeat(20));
    expect(inviteToken(new Uint8Array(20).fill(255))).toBe('9'.repeat(20));
  });
});
