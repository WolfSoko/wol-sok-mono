import {
  backLabelKey,
  backTarget,
  MenuScreen,
  opensFrom,
  parentScreen,
} from './stage-screens';

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

describe('backTarget', () => {
  it('leads back to the pause menu while the match is paused', () => {
    expect(backTarget('settings', true)).toBe('pause');
  });

  it('leads back to the parent screen otherwise', () => {
    expect(backTarget('achievements', false)).toBe('profile');
    expect(backTarget('settings', false)).toBe('menu');
  });
});

describe('backLabelKey', () => {
  it('names the pause menu, the profile and the menu', () => {
    expect(backLabelKey('pause')).toBe('stage.pause.back');
    expect(backLabelKey('profile')).toBe('profile.title');
    expect(backLabelKey('menu')).toBe('common.menu');
  });
});
