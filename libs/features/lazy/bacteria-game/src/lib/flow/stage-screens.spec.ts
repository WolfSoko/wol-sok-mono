import { MenuScreen, opensFrom, parentScreen } from './stage-screens';

describe('parentScreen', () => {
  it('leads from the achievements back to the profile', () => {
    expect(parentScreen('achievements')).toBe('profile');
  });

  it.each<MenuScreen>(['profile', 'settings', 'new-game', 'replay', 'menu'])(
    'leads from %s back to the menu',
    (screen) => {
      expect(parentScreen(screen)).toBe('menu');
    }
  );
});

describe('opensFrom', () => {
  it('holds for the screen itself and the screens opened from it', () => {
    expect(opensFrom('profile', 'profile')).toBe(true);
    expect(opensFrom('achievements', 'profile')).toBe(true);
  });

  it('holds for nothing else', () => {
    expect(opensFrom('menu', 'profile')).toBe(false);
    expect(opensFrom('pause', 'profile')).toBe(false);
    expect(opensFrom(null, 'profile')).toBe(false);
  });
});
