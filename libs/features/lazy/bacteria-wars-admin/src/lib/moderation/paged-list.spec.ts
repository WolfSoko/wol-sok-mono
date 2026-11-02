import { PagedList } from './paged-list';

describe('PagedList', () => {
  it('loads a page, then the next one, until there is none', async () => {
    const list = new PagedList<number>();
    const source = jest.fn(async (after: unknown) =>
      after === null ? { rows: [1, 2], next: 'b' } : { rows: [3], next: null }
    );

    await list.load(source);
    expect(list.rows()).toEqual([1, 2]);
    expect(list.hasMore()).toBe(true);

    await list.more();
    expect(source).toHaveBeenLastCalledWith('b');
    expect(list.rows()).toEqual([1, 2, 3]);
    expect(list.hasMore()).toBe(false);

    await list.more();
    expect(source).toHaveBeenCalledTimes(2);
  });

  it('starts over on reload', async () => {
    const list = new PagedList<number>();
    let calls = 0;
    await list.load(async () => ({ rows: [++calls], next: null }));
    await list.reload();
    expect(list.rows()).toEqual([2]);
  });

  it('drops a page that comes back after a newer load', async () => {
    const list = new PagedList<string>();
    let finish: (page: { rows: string[]; next: null }) => void = () =>
      undefined;
    const slow = list.load(() => new Promise((resolve) => (finish = resolve)));
    await list.load(async () => ({ rows: ['new'], next: null }));
    finish({ rows: ['old'], next: null });
    await slow;
    expect(list.rows()).toEqual(['new']);
    expect(list.loading()).toBe(false);
  });

  it('says when a page failed', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {
      // expected
    });
    const list = new PagedList<number>();
    await list.load(async () => {
      throw new Error('denied');
    });
    expect(list.failed()).toBe(true);
    expect(list.loading()).toBe(false);
    error.mockRestore();
  });
});
