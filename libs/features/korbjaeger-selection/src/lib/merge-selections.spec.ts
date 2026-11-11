import { SELECTION_LIMITS, type SelectionContent } from './selection-lists';
import { mergeSelections } from './merge-selections';

const EMPTY: SelectionContent = { teams: [], children: [], clubColors: [] };

describe('zusammenfuehren', () => {
  it("takes the device's choices into an empty account", () => {
    const device: SelectionContent = {
      teams: [313036, 201500],
      children: [{ personId: 4711, nickname: 'Mimi' }],
      clubColors: [],
    };

    expect(mergeSelections(EMPTY, device)).toEqual({
      content: device,
      left: EMPTY,
    });
  });

  it("gives the device's Teams no place of their own: they join after the account's", () => {
    const account: SelectionContent = {
      ...EMPTY,
      teams: [201765],
      since: { teams: new Map([[201765, 50]]) },
    };
    const device: SelectionContent = {
      ...EMPTY,
      teams: [313036],
      since: { teams: new Map([[313036, 1]]) },
    };

    const { content } = mergeSelections(account, device);

    expect(content.teams).toEqual([201765, 313036]);
    expect(content.since?.teams?.has(313036) ?? false).toBe(false);
  });

  it("keeps an account's choices where the device holds none", () => {
    const account: SelectionContent = {
      teams: [313036],
      children: [{ personId: 4711 }],
      clubColors: [],
    };

    expect(mergeSelections(account, EMPTY).content).toBe(account);
  });

  it("joins overlapping choices: the account's first, each once", () => {
    const account: SelectionContent = {
      teams: [313036, 201765],
      children: [{ personId: 4711, nickname: 'Mimi' }, { personId: 4712 }],
      clubColors: [],
    };
    const device: SelectionContent = {
      teams: [201500, 313036],
      children: [
        { personId: 4713 },
        { personId: 4711, nickname: 'Mia' },
        { personId: 4712, nickname: 'Mo' },
      ],
      clubColors: [],
    };

    expect(mergeSelections(account, device).content).toEqual({
      teams: [313036, 201765, 201500],
      children: [
        // the account's Spitzname wins; the device fills a missing one
        { personId: 4711, nickname: 'Mimi' },
        { personId: 4712, nickname: 'Mo' },
        { personId: 4713 },
      ],
      clubColors: [],
    });
  });

  it('changes nothing of an account already set up with these choices', () => {
    const account: SelectionContent = {
      teams: [313036, 201500],
      children: [{ personId: 4711, nickname: 'Mimi' }],
      clubColors: [],
    };

    const { content: together } = mergeSelections(account, {
      teams: [201500],
      children: [{ personId: 4711 }],
      clubColors: [],
    });

    expect(together.teams).toBe(account.teams);
    expect(together.children).toBe(account.children);
  });

  it('gives the same on a second sign-in as on the first', () => {
    const account: SelectionContent = {
      teams: [313036],
      children: [],
      clubColors: [],
    };
    const device: SelectionContent = {
      teams: [201500],
      children: [{ personId: 4711, nickname: 'Mimi' }],
      clubColors: [],
    };
    const once = mergeSelections(account, device).content;

    expect(mergeSelections(once, device).content).toEqual(once);
  });

  it("takes the device's choices only up to the caps, the account's first", () => {
    const ids = (count: number, ab: number) =>
      Array.from({ length: count }, (_, i) => ab + i);
    const account: SelectionContent = {
      teams: ids(SELECTION_LIMITS.teams - 2, 1),
      children: ids(SELECTION_LIMITS.children, 1).map((personId) => ({
        personId,
      })),
      clubColors: [],
    };
    const device: SelectionContent = {
      teams: [1, 9001, 9002, 9003, 9004],
      children: [{ personId: 9001 }, { personId: 1, nickname: 'Mimi' }],
      clubColors: [],
    };

    const { content, left: leftOver } = mergeSelections(account, device);

    expect(content.teams).toEqual([...account.teams, 9001, 9002]);
    expect(content.children).toHaveLength(SELECTION_LIMITS.children);
    // a Spitzname for a Kind the account holds still joins
    expect(content.children[0]).toEqual({ personId: 1, nickname: 'Mimi' });
    expect(leftOver).toEqual({
      teams: [9003, 9004],
      children: [{ personId: 9001 }],
      clubColors: [],
    });
  });

  it("takes the device's Vereinsfarben for the other Vereine, the account's winning", () => {
    const account: SelectionContent = {
      ...EMPTY,
      clubColors: [{ clubId: 4343, primary: '#1d4ed8' }],
    };
    const device: SelectionContent = {
      ...EMPTY,
      clubColors: [
        { clubId: 4242, primary: '#c8102e' },
        { clubId: 4343, primary: '#007a3d' },
      ],
    };

    const { content, left: leftOver } = mergeSelections(account, device);

    expect(content.clubColors).toEqual([
      { clubId: 4242, primary: '#c8102e' },
      { clubId: 4343, primary: '#1d4ed8' },
    ]);
    expect(leftOver.clubColors).toEqual([]);
    expect(mergeSelections(content, device).content).toBe(content);
  });

  it("takes the device's Vereinsfarben only up to their cap", () => {
    const colors = (count: number, ab: number) =>
      Array.from({ length: count }, (_, i) => ({
        clubId: ab + i,
        primary: '#c8102e',
      }));
    const account: SelectionContent = {
      ...EMPTY,
      clubColors: colors(SELECTION_LIMITS.clubColors - 1, 1),
    };
    const device: SelectionContent = { ...EMPTY, clubColors: colors(2, 9001) };

    const { content, left: leftOver } = mergeSelections(account, device);

    expect(content.clubColors).toHaveLength(SELECTION_LIMITS.clubColors);
    expect(leftOver.clubColors).toEqual([{ clubId: 9002, primary: '#c8102e' }]);
  });
});
