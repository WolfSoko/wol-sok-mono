import { MenuScreen, parentScreen } from './stage-screens';

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
