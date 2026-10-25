import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FakeGameReplays } from '../../testing/fake-game-replays';
import { recordedReplay } from '../../testing/recorded-replay';
import { I18nService } from '../i18n/i18n.service';
import { GameSettingsService } from '../settings.service';
import { BALANCE_VERSION } from '../state/game-balance';
import { GameStateService } from '../state/game-state.service';
import { GameReplays } from '../storage/game-replays';
import { ReplayNoteComponent } from './replay-note.component';

describe('ReplayNoteComponent', () => {
  let replays: FakeGameReplays;
  let fixture: ComponentFixture<ReplayNoteComponent>;
  let page: HTMLElement;

  function setUp(cloud = true): void {
    TestBed.resetTestingModule();
    replays = new FakeGameReplays(false, cloud);
    TestBed.configureTestingModule({
      providers: [{ provide: GameReplays, useValue: replays }],
    });
    TestBed.inject(I18nService).setLanguage('en');
    fixture = TestBed.createComponent(ReplayNoteComponent);
    page = fixture.nativeElement as HTMLElement;
  }

  const recording = () => TestBed.inject(GameStateService).lastRecording;

  beforeEach(() => setUp());

  it('shows nothing for a match that was not recorded', () => {
    fixture.detectChanges();

    expect(page.textContent?.trim()).toBe('');
  });

  it('says "saved" only once the replay is stored, and offers to watch it', async () => {
    const replay = recordedReplay();
    const id = await replays.submit({ replay, hint: 30 });
    recording().set({ replay, hint: 30, id });
    fixture.detectChanges();

    expect(page.textContent).toContain('Saving the replay');
    replays.accept();
    fixture.detectChanges();
    expect(page.textContent).toContain('Replay saved in My matches');

    const watch = jest.fn();
    fixture.componentInstance.watch.subscribe(watch);
    page.querySelector('button')?.click();
    expect(watch).toHaveBeenCalled();
  });

  it('says a local match was not saved with "Save my matches" off', () => {
    TestBed.inject(GameSettingsService).saveMatches.set(false);
    recording().set({ replay: recordedReplay(), hint: 30, id: null });
    fixture.detectChanges();

    expect(page.textContent).toContain('"Save my matches" is off');
    expect(page.querySelector('button')).not.toBeNull();
  });

  it('offers no replay that would not play back', () => {
    const replay = recordedReplay();
    recording().set({
      replay: {
        ...replay,
        header: { ...replay.header, balanceVersion: BALANCE_VERSION - 1 },
      },
      hint: 30,
      id: null,
    });
    fixture.detectChanges();

    expect(page.querySelector('button')).toBeNull();
  });
});
