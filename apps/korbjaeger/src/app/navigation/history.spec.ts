import {
  canGoBack,
  canGoForward,
  EMPTY_HISTORY,
  type HistoryStep,
  historyAfter,
  type NavigationHistory,
} from './history';

function after(...steps: HistoryStep[]): NavigationHistory {
  return steps.reduce(historyAfter, EMPTY_HISTORY);
}

const push = (id: number): HistoryStep => ({ kind: 'push', id });
const replace = (id: number): HistoryStep => ({ kind: 'replace', id });
/** Back or forward to the entry of `restoredId`, which then holds `id`. */
const restore = (restoredId: number, id = restoredId): HistoryStep => ({
  kind: 'restore',
  restoredId,
  id,
});

describe('historyAfter', () => {
  it('starts with the first navigation, which replaces the entry the browser opened', () => {
    const history = after(replace(1));

    expect(history).toEqual({ entries: [1], position: 0 });
    expect(canGoBack(history)).toBe(false);
    expect(canGoForward(history)).toBe(false);
  });

  it('adds an entry per navigation, with the previous ones behind it', () => {
    const history = after(replace(1), push(2), push(3));

    expect(history).toEqual({ entries: [1, 2, 3], position: 2 });
    expect(canGoBack(history)).toBe(true);
    expect(canGoForward(history)).toBe(false);
  });

  it('moves back and forward to the entry the browser restored', () => {
    const back = after(replace(1), push(2), push(3), restore(2));

    expect(back.position).toBe(1);
    expect(canGoBack(back)).toBe(true);
    expect(canGoForward(back)).toBe(true);
    expect(historyAfter(back, restore(3)).position).toBe(2);
  });

  it('finds an entry again under the id the restoring navigation gave it', () => {
    // overview, Team, Spiel; back (the Team's entry now holds 4), forward (5), back
    const history = after(
      replace(1),
      push(2),
      push(3),
      restore(2, 4),
      restore(3, 5),
      restore(4, 6)
    );

    expect(history).toEqual({ entries: [1, 6, 5], position: 1 });
    expect(canGoBack(history)).toBe(true);
    expect(canGoForward(history)).toBe(true);
  });

  it('drops the entries ahead once a new navigation follows going back', () => {
    const history = after(replace(1), push(2), push(3), restore(1), push(4));

    expect(history).toEqual({ entries: [1, 4], position: 1 });
    expect(canGoForward(history)).toBe(false);
  });

  it('replaces the current entry and keeps those around it', () => {
    const history = after(replace(1), push(2), push(3), restore(2), replace(5));

    expect(history).toEqual({ entries: [1, 5, 3], position: 1 });
  });

  it('starts anew on an entry it does not know, one from before a reload', () => {
    const history = after(replace(7), restore(3, 8));

    expect(history).toEqual({ entries: [8], position: 0 });
    expect(canGoBack(history)).toBe(false);
  });
});
