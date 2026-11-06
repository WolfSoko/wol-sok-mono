import {
  LEVELS,
  MATCH_LEVELS,
  playableOnline,
} from '@wolsok/feat-shared-bacteria-engine';
import {
  DEFAULT_EFFECTS_VOLUME,
  DEFAULT_MUSIC_VOLUME,
  MAX_VOLUME,
  SETTINGS,
} from './setting-table';

describe('SETTINGS', () => {
  it('starts the game with sound, music, effects and vibration at their volumes', () => {
    expect(SETTINGS.sound.default).toBe(true);
    expect(SETTINGS.music.default).toBe(true);
    expect(SETTINGS.effects.default).toBe(true);
    expect(SETTINGS.vibration.default).toBe(true);
    expect(SETTINGS.musicVolume.default).toBe(DEFAULT_MUSIC_VOLUME);
    expect(SETTINGS.effectsVolume.default).toBe(DEFAULT_EFFECTS_VOLUME);
  });

  it('draws slime at the default resolutions, vaporizing at medium quality in 2.5 s', () => {
    expect(SETTINGS.look.default).toBe('slime');
    expect(SETTINGS.simResolution.default).toBe('normal');
    expect(SETTINGS.screenResolution.default).toBe('medium');
    expect(SETTINGS.vaporize.default).toBe('medium');
    expect(SETTINGS.vaporizeMs.default).toBe(2500);
  });

  it('records, keeps and ranks matches unless told otherwise', () => {
    expect(SETTINGS.recordLocal.default).toBe(true);
    expect(SETTINGS.saveMatches.default).toBe(true);
    expect(SETTINGS.ranked.default).toBe(true);
    expect(SETTINGS.recordingHintShown.default).toBe(false);
  });

  it('follows the browser, the level and any matchmaking level by default', () => {
    expect(SETTINGS.language.default).toBeNull();
    expect(SETTINGS.arena.default).toBeNull();
    expect(SETTINGS.matchLevel.default).toBeNull();
    expect(SETTINGS.freePlay.default).toBe(false);
  });

  it('keeps the volumes on the slider', () => {
    const music = SETTINGS.musicVolume;

    expect(music.normalize?.(140)).toBe(MAX_VOLUME);
    expect(music.normalize?.(-3)).toBe(0);
    expect(music.normalize?.(33.4)).toBe(33);
    expect(music.normalize?.(Number.NaN)).toBe(DEFAULT_MUSIC_VOLUME);
    expect(SETTINGS.effectsVolume.normalize?.(Number.NaN)).toBe(
      DEFAULT_EFFECTS_VOLUME
    );
  });

  it('reads back only whole volumes on the slider', () => {
    expect(SETTINGS.musicVolume.parse(35)).toBe(35);
    expect(SETTINGS.musicVolume.parse(35.5)).toBeUndefined();
    expect(SETTINGS.musicVolume.parse(250)).toBeUndefined();
  });

  it('takes only a level that plays online for the matchmaking', () => {
    const offline = LEVELS.find((level) => !playableOnline(level))?.id ?? '';
    const matchLevel = SETTINGS.matchLevel;

    expect(matchLevel.normalize?.(MATCH_LEVELS[2].id)).toBe(MATCH_LEVELS[2].id);
    expect(matchLevel.normalize?.(offline)).toBeNull();
    for (const stored of ['moon', offline, 42]) {
      expect(matchLevel.parse(stored)).toBeUndefined();
    }
  });

  it('reports what players pick, not the volumes or what the game remembers', () => {
    const unreported = Object.entries(SETTINGS)
      .filter(([, spec]) => !spec.reported)
      .map(([key]) => key);

    expect(unreported.sort()).toEqual([
      'arena',
      'effectsVolume',
      'matchLevel',
      'musicVolume',
      'recordingHintShown',
    ]);
  });
});
