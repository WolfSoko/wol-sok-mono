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
});
