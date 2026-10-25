import { TestBed } from '@angular/core/testing';
import { recordedReplay } from '../../testing/recorded-replay';
import {
  RecordingPainter,
  recordingPainters,
} from '../../testing/recording-painter';
import { I18nService } from '../i18n/i18n.service';
import { BALANCE_VERSION } from '../state/game-balance';
import { ReplayScene } from './replay-scene';
import { ReplayViewerComponent } from './replay-viewer.component';

describe('ReplayScene', () => {
  const look = { look: 'slime' as const, reducedMotion: false };

  it('plays a recorded match to its end, and from the start again', () => {
    const replay = recordedReplay('petri-dish', 60);
    const scene = ReplayScene.of(replay, look);

    scene?.advance(replay.header.ticks + 10);

    expect(scene?.over).toBe(true);
    expect(scene?.tick).toBe(replay.header.ticks);
    expect(scene?.content(0.5).colonies.length).toBeGreaterThan(0);
    scene?.restart();
    expect(scene?.over).toBe(false);
    expect(scene?.tick).toBe(0);
    scene?.dispose();
  });

  it('plays no replay of another balance', () => {
    const replay = recordedReplay();
    const older = {
      ...replay,
      header: { ...replay.header, balanceVersion: BALANCE_VERSION - 1 },
    };

    expect(ReplayScene.of(older, look)).toBeNull();
  });
});

describe('ReplayViewerComponent', () => {
  let painters: RecordingPainter[];

  beforeEach(() => {
    painters = [];
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [recordingPainters(painters)],
    });
    TestBed.inject(I18nService).setLanguage('en');
  });

  function view(replay = recordedReplay()) {
    const fixture = TestBed.createComponent(ReplayViewerComponent);
    fixture.componentRef.setInput('replay', replay);
    fixture.detectChanges();
    return { fixture, page: fixture.nativeElement as HTMLElement };
  }

  it('plays the replay on an arena view, with pause and speeds', () => {
    const { fixture, page } = view();

    expect(page.querySelector('feat-lazy-bac-game-arena-view')).not.toBeNull();
    expect(painters).toHaveLength(1);
    const button = page.querySelector(
      '[data-testid="play-pause"]'
    ) as HTMLButtonElement;
    expect(button.textContent).toContain('Pause');

    button.click();
    fixture.detectChanges();

    expect(button.textContent).toContain('Play');
    expect(page.textContent).toContain('4×');
  });

  it('says so for a replay it cannot play', () => {
    const replay = recordedReplay();
    const { page } = view({
      ...replay,
      header: { ...replay.header, balanceVersion: BALANCE_VERSION - 1 },
    });

    expect(page.querySelector('[role="alert"]')?.textContent).toContain(
      'older version'
    );
    expect(page.querySelector('feat-lazy-bac-game-arena-view')).toBeNull();
  });

  it('lets go of the painter and the engine when it goes', () => {
    const { fixture } = view();

    fixture.destroy();

    expect(painters[0].disposed).toBe(true);
  });
});
