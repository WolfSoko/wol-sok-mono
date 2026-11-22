import { RANKS } from '@wolsok/feat-shared-bacteria-engine';
import {
  BACTERIUM_ANCHORS,
  type BacteriumItemId,
  bacteriumItems,
  type BacteriumMenuState,
} from './bacterium-items';
import { bacteriumLook, cssRgb } from './bacterium-look';

const STATE: BacteriumMenuState = {
  training: true,
  online: true,
  friends: true,
  leaderboards: true,
  colonyDna: 0,
  evolveDna: 0,
  friendRequests: 0,
  gallery: { url: '/replays', external: false },
};

const ids = (state: Partial<BacteriumMenuState>): BacteriumItemId[] =>
  bacteriumItems({ ...STATE, ...state }).map((item) => item.id);

describe('bacteriumItems', () => {
  it('offers a new game, online and every tile, in reading order', () => {
    expect(ids({})).toEqual([
      'play',
      'online',
      'training',
      'colony',
      'evolution',
      'profile',
      'friends',
      'leaderboards',
      'my-matches',
      'gallery',
    ]);
  });

  it('leaves out what the tiles leave out', () => {
    expect(
      ids({
        training: false,
        online: false,
        friends: false,
        leaderboards: false,
      })
    ).toEqual([
      'play',
      'colony',
      'evolution',
      'profile',
      'my-matches',
      'gallery',
    ]);
  });

  it('counts DNA to spend and friend requests on their parts', () => {
    const items = bacteriumItems({
      ...STATE,
      colonyDna: 3,
      evolveDna: 0,
      friendRequests: 2,
    });
    const of = (id: BacteriumItemId) => items.find((item) => item.id === id);
    expect(of('colony')).toMatchObject({
      count: 3,
      countKey: 'colony.menu.ready',
    });
    expect(of('evolution')).toMatchObject({ count: 0, countKey: null });
    expect(of('friends')).toMatchObject({
      count: 2,
      countKey: 'menu.friendRequests',
    });
  });

  it('links the matches of the day, and picks the rest', () => {
    const items = bacteriumItems({
      ...STATE,
      gallery: {
        url: 'https://bacteria-wars.wolsok.de/replays',
        external: true,
      },
    });
    expect(items.find((item) => item.id === 'gallery')?.link).toEqual({
      url: 'https://bacteria-wars.wolsok.de/replays',
      external: true,
    });
    expect(
      items.filter((item) => item.id !== 'gallery').every((item) => !item.link)
    ).toBe(true);
  });
});

describe('BACTERIUM_ANCHORS', () => {
  it('put a new game in the middle and online on the biggest lobe', () => {
    expect(BACTERIUM_ANCHORS.play).toMatchObject({ x: 0, y: 0 });
    const lobes = Object.entries(BACTERIUM_ANCHORS).filter(
      ([id]) => id !== 'play'
    );
    const biggest = Math.max(...lobes.map(([, anchor]) => anchor.r));
    expect(BACTERIUM_ANCHORS.online.r).toBe(biggest);
    expect(BACTERIUM_ANCHORS.online.y).toBeGreaterThan(0);
  });

  it('keep every lobe inside the box and apart from the others', () => {
    const anchors = Object.values(BACTERIUM_ANCHORS);
    for (const anchor of anchors) {
      expect(Math.abs(anchor.x)).toBeLessThan(1);
      expect(Math.abs(anchor.y)).toBeLessThan(1);
    }
    for (const [i, a] of anchors.entries()) {
      for (const b of anchors.slice(i + 1)) {
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.2);
      }
    }
  });
});

describe('bacteriumLook', () => {
  const top = RANKS[RANKS.length - 1].xp;

  it('starts a Spore as a plain cell', () => {
    expect(bacteriumLook(0)).toMatchObject({
      growth: 0,
      flagella: 0,
      pili: 0,
      organelles: 1,
    });
  });

  it('grows with every rank, up to a Superbug', () => {
    const looks = RANKS.map((rank) => bacteriumLook(rank.xp));
    for (const [i, look] of looks.slice(1).entries()) {
      const before = looks[i];
      expect(look.growth).toBeGreaterThan(before.growth);
      expect(look.flagella).toBeGreaterThanOrEqual(before.flagella);
      expect(look.pili).toBeGreaterThanOrEqual(before.pili);
      expect(look.organelles).toBeGreaterThanOrEqual(before.organelles);
      expect(look.glow).toBeGreaterThan(before.glow);
    }
    expect(bacteriumLook(top)).toMatchObject({
      growth: 1,
      flagella: 6,
      organelles: 8,
      glow: 1,
    });
    expect(bacteriumLook(top).pili).toBeGreaterThan(30);
  });

  it('grows on the way to the next rank too', () => {
    expect(bacteriumLook(400).growth).toBeGreaterThan(
      bacteriumLook(250).growth
    );
  });

  it('writes its colours as CSS', () => {
    expect(cssRgb([1, 0.5, 0], 0.5)).toBe('rgb(255 128 0 / 0.5)');
  });
});
