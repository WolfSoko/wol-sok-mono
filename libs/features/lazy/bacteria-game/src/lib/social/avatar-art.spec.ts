import { avatarArt } from './avatar-art';
import { AVATAR_COUNT } from './profile';

describe('avatarArt', () => {
  it('draws the same bacterium for an id, another for each id', () => {
    const bodies = Array.from(
      { length: AVATAR_COUNT },
      (_, id) => avatarArt(id).body
    );

    expect(avatarArt(5)).toEqual(avatarArt(5));
    expect(new Set(bodies).size).toBe(AVATAR_COUNT);
    expect(avatarArt(0).body).toMatch(/^M[\d. ]+( Q[\d. ]+)+ Z$/);
  });
});
