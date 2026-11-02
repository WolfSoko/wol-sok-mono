import { isRealtimeKey } from '../admin/realtime';
import { mirrorPaths } from './mirror';

describe('the friend lists mirror', () => {
  it('mirrors a friend for the status and the deletion, a request for the deletion', () => {
    expect(mirrorPaths('friends', 'ada', 'bob', true)).toEqual({
      'statusReaders/ada/bob': true,
      'listedBy/bob/ada/friends': true,
    });
    expect(mirrorPaths('requests', 'ada', 'bob', false)).toEqual({
      'listedBy/bob/ada/requests': null,
    });
  });

  it('takes as keys only ids the Realtime Database takes', () => {
    expect(isRealtimeKey('aB3xYz9QwErTyUiOpAsDfGhJkL12')).toBe(true);
    expect(isRealtimeKey('a-b_c')).toBe(true);
    for (const bad of [
      '',
      'a.b',
      'a#b',
      'a$b',
      'a[b',
      'a]b',
      'a/b',
      'a\u0001b',
    ]) {
      expect([bad, isRealtimeKey(bad)]).toEqual([bad, false]);
    }
    expect(isRealtimeKey('x'.repeat(769))).toBe(false);
  });
});
