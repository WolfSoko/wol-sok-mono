import { isOutsideFolder } from './outside-folder';

const WORKSPACE = '/home/user/wol-sok-mono';

describe('isOutsideFolder', () => {
  it.each([
    '/tmp/dbb-raw',
    '/home/user',
    '/home/user/wol-sok-mono-raw',
    '/home/user/other/raw',
  ])('takes %s as outside', (candidate) => {
    expect(isOutsideFolder(WORKSPACE, candidate)).toBe(true);
  });

  it.each([
    WORKSPACE,
    `${WORKSPACE}/raw`,
    `${WORKSPACE}/..raw`,
    `${WORKSPACE}/...`,
    `${WORKSPACE}/libs/features/basketball-data/src/lib/dbb/fixtures`,
  ])('takes %s as inside', (candidate) => {
    expect(isOutsideFolder(WORKSPACE, candidate)).toBe(false);
  });
});
