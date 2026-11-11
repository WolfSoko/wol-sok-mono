import {
  handOverChange,
  unfollowChange,
  followChange,
  teamPlace,
} from './selection-changes';
import { EMPTY_SELECTION, type SelectionContent } from './selection-lists';

const A = 313036;
const B = 201765;
const C = 201500;
const D = 201999;

const read: SelectionContent = {
  ...EMPTY_SELECTION,
  teams: [A, B, C],
  since: {
    teams: new Map([
      [A, 10],
      [B, 20],
      [C, 30],
    ]),
  },
};

describe('teamPlatz', () => {
  it("is the Team's place among Meine Teams", () => {
    expect(teamPlace(read, B)).toEqual({ since: 20 });
  });

  it('is none for a Team not followed, or one whose seit is not known yet', () => {
    expect(teamPlace(read, D)).toBeUndefined();
    expect(teamPlace({ ...EMPTY_SELECTION, teams: [D] }, D)).toBeUndefined();
  });
});

describe('folgenAenderung', () => {
  const withoutB = unfollowChange(B)(read);

  it('follows a Team at its place, before the first Team with a later seit', () => {
    const place = teamPlace(read, B);

    const after = followChange(B, place)(withoutB);

    expect(after.teams).toEqual([A, B, C]);
    expect(after.since?.teams?.get(B)).toBe(20);
  });

  it('puts a Team at its place before Teams whose seit is not known yet', () => {
    const withD = followChange(D)(withoutB);

    expect(followChange(B, { since: 20 })(withD).teams).toEqual([A, B, C, D]);
  });

  it('puts a Team before one with the same seit and a larger id, as the reader orders', () => {
    const equal: SelectionContent = {
      ...EMPTY_SELECTION,
      teams: [B],
      since: { teams: new Map([[B, 20]]) },
    };

    expect(followChange(C, { since: 20 })(equal).teams).toEqual([C, B]);
    expect(followChange(A, { since: 20 })(equal).teams).toEqual([B, A]);
  });

  it('follows at the end without a place', () => {
    expect(followChange(B)(withoutB).teams).toEqual([A, C, B]);
  });

  it('changes nothing for a Team followed already', () => {
    expect(followChange(B, { since: 1 })(read)).toBe(read);
  });
});

describe('a plain follow after an unfollow', () => {
  it('keeps no old seit for the Team, so the write gives it a new one', () => {
    const again = followChange(B)(unfollowChange(B)(read));

    expect(again.since?.teams?.has(B)).toBe(false);
  });
});

describe('abgebenAenderung', () => {
  it('keeps the places of the Teams that stay', () => {
    const after = handOverChange({ ...EMPTY_SELECTION, teams: [B] })(read);

    expect(teamPlace(after, A)).toEqual({ since: 10 });
    expect(teamPlace(after, C)).toEqual({ since: 30 });
    expect(teamPlace(after, B)).toBeUndefined();
  });
});
