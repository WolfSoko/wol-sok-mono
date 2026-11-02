import { randomWindDirection } from './random-wind';

describe('randomWindDirection', () => {
  afterEach(() => jest.restoreAllMocks());

  it('should blow into any direction around the circle', () => {
    const directions = [0, 0.25, 0.5, 0.999].map((random) => {
      jest.spyOn(Math, 'random').mockReturnValue(random);
      return randomWindDirection();
    });

    expect(directions).toEqual([0, 90, 180, 359]);
  });
});
