import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EvolutionService } from '../evolution.service';
import { I18nService } from '../i18n/i18n.service';
import { MatchEarnings } from '../state/earnings';
import { GameStateStore } from '../state/game.states';
import { LEVELS } from '../state/levels';
import { createPlayer } from '../state/player.model';
import { WinnerComponent } from './winner.component';

/** The result screen's line on the DNA a match grew, and the way to spend it. */
describe('WinnerComponent DNA', () => {
  let fixture: ComponentFixture<WinnerComponent>;
  let store: GameStateStore;
  const canEvolve = signal(false);

  beforeEach(async () => {
    canEvolve.set(false);
    await TestBed.configureTestingModule({
      imports: [WinnerComponent],
      providers: [{ provide: EvolutionService, useValue: { canEvolve } }],
    }).compileComponents();
    store = TestBed.inject(GameStateStore);
    fixture = TestBed.createComponent(WinnerComponent);
  });

  function won(xp: number, xpBefore: number | null): void {
    const earnings: MatchEarnings = {
      award: null,
      achievements: [],
      xp: { parts: [{ label: 'Win', xp }], total: xp },
      xpBefore,
      unlocked: [],
      cosmetics: [],
    };
    store.update({
      mode: 'vs-computer',
      winner: createPlayer({ id: 0, name: 'You' }),
      levelId: LEVELS[0].id,
      earnings,
    });
    fixture.detectChanges();
  }

  function dnaLine(): string | null {
    return (
      (fixture.nativeElement as HTMLElement)
        .querySelector('.dna-count')
        ?.textContent?.trim() ?? null
    );
  }

  function evolveButton(): HTMLButtonElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.evolve');
  }

  it('shows the strands the XP grew', () => {
    // 80 -> 205 XP crosses 100, 150 and 200: three strands.
    won(125, 80);

    expect(dnaLine()).toBe('+3 DNA');
  });

  it('shows none for XP that grew no strand, or where the XP before is unknown', () => {
    won(20, 10);
    expect(dnaLine()).toBeNull();

    won(500, null);
    expect(dnaLine()).toBeNull();
  });

  it('leads to the Evolution screen when the DNA buys something', () => {
    won(125, 80);
    expect(evolveButton()).toBeNull();

    canEvolve.set(true);
    fixture.detectChanges();
    const picked = jest.fn();
    fixture.componentInstance.action.subscribe(picked);
    evolveButton()?.click();

    expect(evolveButton()?.textContent).toContain('Evolve');
    expect(picked).toHaveBeenCalledWith('evolve');
  });

  it('offers nothing to evolve after an online match', () => {
    canEvolve.set(true);
    store.update({
      online: { seat: 0, levelId: LEVELS[0].id, colors: ['orange', 'blue'] },
    });
    won(125, 80);

    expect(evolveButton()).toBeNull();
  });

  it('speaks German', () => {
    canEvolve.set(true);
    won(125, 80);
    TestBed.inject(I18nService).setLanguage('de');
    fixture.detectChanges();

    expect(evolveButton()?.textContent).toContain('Entwickeln');
  });
});
