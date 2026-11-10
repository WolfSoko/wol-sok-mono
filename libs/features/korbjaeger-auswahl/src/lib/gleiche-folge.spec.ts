import { gleicheFolge } from './gleiche-folge';

describe('gleicheFolge', () => {
  it('takes two lists of the same values in the same order as equal', () => {
    expect(gleicheFolge([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(gleicheFolge([], [])).toBe(true);
  });

  it.each([
    ['another order', [2, 1]],
    ['one more', [1, 2, 3]],
    ['one less', [1]],
    ['another value', [1, 3]],
  ])('tells a list with %s apart', (_fall, andere) => {
    expect(gleicheFolge([1, 2], andere)).toBe(false);
  });

  it('compares the entries as told', () => {
    const gleicheId = (a: { id: number }, b: { id: number }) => a.id === b.id;

    expect(gleicheFolge([{ id: 1 }], [{ id: 1 }], gleicheId)).toBe(true);
    expect(gleicheFolge([{ id: 1 }], [{ id: 1 }])).toBe(false);
  });
});
