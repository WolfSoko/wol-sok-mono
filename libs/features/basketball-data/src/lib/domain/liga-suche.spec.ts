import { angeboten, naechsterStartIndex, type Facette } from './liga-suche';

function facette(id: number, name: string, treffer: number): Facette<number> {
  return { id, name, treffer };
}

describe('angeboten', () => {
  it('keeps the choices that leave Ligen, in their order', () => {
    const u12 = facette(12, 'U12', 34);
    const u10 = facette(10, 'U10', 20);

    expect(angeboten([u12, facette(19, 'U19', 0), u10])).toEqual([u12, u10]);
  });
});

describe('naechsterStartIndex', () => {
  it('starts the next page after the Ligen of this one', () => {
    expect(
      naechsterStartIndex({ startIndex: 10, ligen: [], weitere: true })
    ).toBe(10);
  });

  it('names none after the last page', () => {
    expect(
      naechsterStartIndex({ startIndex: 20, ligen: [], weitere: false })
    ).toBeUndefined();
  });
});
