import { sameSequence } from './same-sequence';

describe('sameSequence', () => {
  it('takes two lists of the same values in the same order as equal', () => {
    expect(sameSequence([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(sameSequence([], [])).toBe(true);
  });

  it.each([
    ['another order', [2, 1]],
    ['one more', [1, 2, 3]],
    ['one less', [1]],
    ['another value', [1, 3]],
  ])('tells a list with %s apart', (_case, others) => {
    expect(sameSequence([1, 2], others)).toBe(false);
  });

  it('compares the entries as told', () => {
    const sameId = (a: { id: number }, b: { id: number }) => a.id === b.id;

    expect(sameSequence([{ id: 1 }], [{ id: 1 }], sameId)).toBe(true);
    expect(sameSequence([{ id: 1 }], [{ id: 1 }])).toBe(false);
  });
});
