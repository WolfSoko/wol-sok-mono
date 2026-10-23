import { randomCrumble } from './random-crumble';

describe('randomCrumble', () => {
  afterEach(() => jest.restoreAllMocks());

  it('should pick any crumble variant', () => {
    const picked = new Set(
      [0, 0.3, 0.6, 0.9].map((random) => {
        jest.spyOn(Math, 'random').mockReturnValue(random);
        return randomCrumble();
      })
    );

    expect(picked).toEqual(new Set(['dust', 'cracks', 'shards', 'chunks']));
  });

  it('should never pick the last variant again', () => {
    for (const random of [0, 0.4, 0.99]) {
      jest.spyOn(Math, 'random').mockReturnValue(random);
      expect(randomCrumble('dust')).not.toBe('dust');
    }
  });
});
