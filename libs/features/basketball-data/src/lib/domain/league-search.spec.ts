import { offered, nextStartIndex, type Facet } from './league-search';

function facet(id: number, name: string, madeOf: number): Facet<number> {
  return { id, name, hits: madeOf };
}

describe('offered', () => {
  it('keeps the choices that leave Ligen, in their order', () => {
    const u12 = facet(12, 'U12', 34);
    const u10 = facet(10, 'U10', 20);

    expect(offered([u12, facet(19, 'U19', 0), u10])).toEqual([u12, u10]);
  });
});

describe('nextStartIndex', () => {
  it('starts the next page after the Ligen of this one', () => {
    expect(nextStartIndex({ startIndex: 10, leagues: [], more: true })).toBe(
      10
    );
  });

  it('names none after the last page', () => {
    expect(
      nextStartIndex({ startIndex: 20, leagues: [], more: false })
    ).toBeUndefined();
  });
});
