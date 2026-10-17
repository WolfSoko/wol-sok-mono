import { TestBed } from '@angular/core/testing';
import { GameSettingsService, SETTINGS_STORAGE_KEY } from './settings.service';
import { GameStateQuery } from './state/game-state.query';
import { GameStateService } from './state/game-state.service';
import { LEVELS } from './state/levels';

describe('GameSettingsService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  function stored(): Record<string, unknown> {
    return JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}');
  }

  it('restores what an earlier visit chose', () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        mode: 'two-players',
        difficulty: 'hard',
        levelId: LEVELS[2].id,
        showFps: true,
      })
    );

    const service = TestBed.inject(GameSettingsService);
    const state = TestBed.inject(GameStateQuery).getValue();

    expect(state.mode).toBe('two-players');
    expect(state.difficulty).toBe('hard');
    expect(state.levelId).toBe(LEVELS[2].id);
    expect(service.showFps()).toBe(true);
  });

  it('ignores values it does not know', () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ mode: 'four-players', levelId: 'moon', showFps: 'yes' })
    );

    const service = TestBed.inject(GameSettingsService);
    const state = TestBed.inject(GameStateQuery).getValue();

    expect(state.mode).toBe('vs-computer');
    expect(state.levelId).toBe(LEVELS[0].id);
    expect(service.showFps()).toBe(false);
  });

  it('survives unreadable storage', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, '{not json');

    expect(() => TestBed.inject(GameSettingsService)).not.toThrow();
  });

  it('remembers a changed match setup', () => {
    TestBed.inject(GameSettingsService);

    TestBed.inject(GameStateService).setMode('two-players');
    TestBed.inject(GameStateService).setLevel(LEVELS[1].id);

    expect(stored()).toMatchObject({
      mode: 'two-players',
      levelId: LEVELS[1].id,
    });
  });

  it('remembers the frame rate badge', () => {
    const service = TestBed.inject(GameSettingsService);

    service.setShowFps(true);

    expect(stored().showFps).toBe(true);
  });
});
