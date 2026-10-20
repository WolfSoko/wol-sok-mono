import { CHAPTERS } from './chapters';
import { LEVELS } from './levels';

describe('the chapters', () => {
  it('hold every level of the ladder once, in its order', () => {
    expect(CHAPTERS.flatMap((chapter) => chapter.levelIds)).toEqual(
      LEVELS.map((level) => level.id)
    );
  });
});
