import { accountKind, gamePlatform } from './user-properties';
import type { GameSupportOptions } from '../support/game-support';

describe('accountKind', () => {
  it('tells a guest from a Google account in the cloud', () => {
    expect(accountKind(true, { guest: true })).toBe('guest');
    expect(accountKind(true, { guest: false })).toBe('google');
  });

  it('waits for the cloud to tell who plays', () => {
    expect(accountKind(true, null)).toBeNull();
  });

  it('names play without the cloud', () => {
    expect(accountKind(false, null)).toBe('device');
  });
});

describe('gamePlatform', () => {
  const support = {
    androidPackage: 'de.wolsok.bacteriawars',
  } as GameSupportOptions;

  afterEach(() => {
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('tells the Play Store app by its launch', () => {
    window.history.replaceState(null, '', '/?source=twa');

    expect(gamePlatform(document, support)).toBe('android_app');
  });

  it('is a browser tab otherwise', () => {
    expect(gamePlatform(document, support)).toBe('browser');
    expect(gamePlatform(document, null)).toBe('browser');
  });
});
