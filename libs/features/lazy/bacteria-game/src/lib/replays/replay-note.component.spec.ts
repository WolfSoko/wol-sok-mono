import { of, throwError } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FakeGameReplays } from '../../testing/fake-game-replays';
import { recordedReplay } from '../../testing/recorded-replay';
import { I18nService } from '../i18n/i18n.service';
import { GameSettingsService, SETTINGS_STORAGE_KEY } from '../settings.service';
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

  beforeEach(() => {
    localStorage.clear();
    setUp();
  });

  const HINT = 'You can turn that off in Settings → Matches.';

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

  it.each([
    ['gives up asking', of(false)],
    ['fails', throwError(() => new Error('offline'))],
  ])(
    'says it could not confirm the save when watching it %s',
    async (_case, watch) => {
      jest.spyOn(replays, 'watchSaved').mockReturnValue(watch);
      const replay = recordedReplay();
      const id = await replays.submit({ replay, hint: 30 });
      recording().set({ replay, hint: 30, id });
      fixture.detectChanges();

      expect(page.textContent).toContain(
        'Could not confirm the replay was saved'
      );
      expect(page.textContent).not.toContain('Saving the replay');
    }
  );

  it('stays "saved" once stored, whenever the watch ends', async () => {
    jest.spyOn(replays, 'watchSaved').mockReturnValue(of(false, true));
    const replay = recordedReplay();
    const id = await replays.submit({ replay, hint: 30 });
    recording().set({ replay, hint: 30, id });
    fixture.detectChanges();

    expect(page.textContent).toContain('Replay saved in My matches');
  });

  it('says once, after the first saved match against the computer, where to turn saving off', async () => {
    const replay = recordedReplay();
    const first = await replays.submit({ replay, hint: 30 });
    recording().set({ replay, hint: 30, id: first });
    fixture.detectChanges();
    expect(page.textContent).not.toContain(HINT);

    replays.accept();
    fixture.detectChanges();
    expect(page.textContent).toContain('Replay saved in My matches');
    expect(page.textContent).toContain(HINT);
    expect(TestBed.inject(GameSettingsService).recordingHintShown()).toBe(true);

    const second = await replays.submit({ replay, hint: 30 });
    recording().set({ replay, hint: 30, id: second });
    replays.accept();
    fixture.detectChanges();
    expect(page.textContent).toContain('Replay saved in My matches');
    expect(page.textContent).not.toContain(HINT);
  });

  it('gives no hint where it was shown on an earlier visit', async () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ recordingHintShown: true })
    );
    setUp();
    const replay = recordedReplay();
    const id = await replays.submit({ replay, hint: 30 });
    recording().set({ replay, hint: 30, id });
    replays.accept();
    fixture.detectChanges();

    expect(page.textContent).toContain('Replay saved in My matches');
    expect(page.textContent).not.toContain(HINT);
  });

  it('gives no hint for an online match, which the settings do not stop', async () => {
    const local = recordedReplay();
    const replay = {
      ...local,
      header: { ...local.header, roomCode: 'K7QPXM', n: 1 },
    };
    const id = await replays.submit({ replay, hint: 30 });
    recording().set({ replay, hint: 30, id });
    replays.accept();
    fixture.detectChanges();

    expect(page.textContent).toContain('Replay saved in My matches');
    expect(page.textContent).not.toContain(HINT);
    expect(TestBed.inject(GameSettingsService).recordingHintShown()).toBe(
      false
    );
  });

  it('gives no hint for a match kept on this device', async () => {
    setUp(false);
    const replay = recordedReplay();
    const id = await replays.submit({ replay, hint: 30 });
    recording().set({ replay, hint: 30, id });
    replays.accept();
    fixture.detectChanges();

    expect(page.textContent).toContain('Replay kept on this device');
    expect(page.textContent).not.toContain(HINT);
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
