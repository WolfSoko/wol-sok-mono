import { fakeCustomToken } from '../../testing/fake-firebase-auth';
import { customTokenUid } from './custom-token';

describe('customTokenUid', () => {
  it('reads the uid of a custom token', () => {
    expect(customTokenUid(fakeCustomToken('ada-1'))).toBe('ada-1');
  });

  it('is null for anything else', () => {
    expect(customTokenUid('')).toBeNull();
    expect(customTokenUid('no-jwt')).toBeNull();
    expect(customTokenUid('a.%%%.c')).toBeNull();
    expect(customTokenUid(`a.${btoa('{"sub":"x"}')}.c`)).toBeNull();
  });
});
