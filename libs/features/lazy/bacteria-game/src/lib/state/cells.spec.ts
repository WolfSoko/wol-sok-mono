import { Cells } from './cells';

/** The bacteria of the columns as [x, y, energy] triples. */
function triples(cells: Cells): number[][] {
  return cells.toBacteria().map(({ x, y, energy }) => [x, y, energy]);
}

describe('Cells', () => {
  it('keeps every bacterium pushed, in order, as the columns grow', () => {
    const cells = new Cells();
    for (let i = 0; i < 200; i++) {
      cells.push(i, i * 2, i + 0.25);
    }

    expect(cells.length).toBe(200);
    expect(cells.x.length).toBeGreaterThanOrEqual(200);
    expect(triples(cells)[0]).toEqual([0, 0, 0.25]);
    expect(triples(cells)[63]).toEqual([63, 126, 63.25]);
    expect(triples(cells)[64]).toEqual([64, 128, 64.25]);
    expect(triples(cells)[199]).toEqual([199, 398, 199.25]);
  });

  it('keeps the unmarked bacteria in their order', () => {
    const cells = Cells.of([
      { x: 1, y: 1, energy: 1 },
      { x: 2, y: 2, energy: 2 },
      { x: 3, y: 3, energy: 3 },
      { x: 4, y: 4, energy: 4 },
    ]);

    cells.keep(Uint8Array.from([0, 1, 0, 1]));

    expect(triples(cells)).toEqual([
      [1, 1, 1],
      [3, 3, 3],
    ]);
  });

  it('keeps all or none, as marked', () => {
    const all = Cells.of([
      { x: 1, y: 1, energy: 1 },
      { x: 2, y: 2, energy: 2 },
    ]);
    all.keep(new Uint8Array(2));
    expect(all.length).toBe(2);

    const none = Cells.of([
      { x: 1, y: 1, energy: 1 },
      { x: 2, y: 2, energy: 2 },
    ]);
    none.keep(Uint8Array.from([1, 1]));
    expect(none.length).toBe(0);
  });

  it('keeps the bacteria added after the marks were made', () => {
    const cells = Cells.of([{ x: 1, y: 1, energy: 1 }]);
    const marks = new Uint8Array(cells.length);
    marks[0] = 1;
    cells.push(2, 2, 2);

    cells.keep(marks);

    expect(triples(cells)).toEqual([[2, 2, 2]]);
  });

  it('puts a bacterium on the cell its position rounds to', () => {
    const cells = Cells.of([{ x: 10.6, y: 4.5, energy: 0.5 }]);

    expect(triples(cells)).toEqual([[11, 5, 0.5]]);
  });

  it('hands its bacteria back as objects, a copy', () => {
    const cells = Cells.of([{ x: 1, y: 2, energy: 3 }]);
    const copy = cells.toBacteria();
    copy[0].energy = 9;

    expect(cells.energy[0]).toBe(3);
  });
});
