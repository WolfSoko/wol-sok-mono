import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
} from '@angular/core';
import { EvolutionService } from '../evolution.service';
import { GpuSelfTestService } from '../gl/gpu-self-test.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ScreenHeaderComponent } from '../menu/screen-header.component';
import { GameStateService } from '../state/game-state.service';
import { ReplayViewerComponent } from './replay-viewer.component';

/**
 * The match just played, watched again from its result (ADR 0011): the
 * replay viewer filling the stage on the recording the match left, its way
 * back to the menu in the viewer's own chrome; the screen's header only
 * where there is nothing to play.
 */
@Component({
  selector: 'feat-lazy-bac-game-replay-screen',
  imports: [ReplayViewerComponent, ScreenHeaderComponent, TranslatePipe],
  host: { '[class.playing]': 'replay() !== null' },
  template: `
    @if (replay(); as replay) {
      <feat-lazy-bac-game-replay-viewer
        [replay]="replay"
        [look]="look()"
        [label]="'replay.viewer.title' | t"
        [gpu]="trustedGpu()"
        [title]="'replay.viewer.title' | t"
        [closeLabel]="'common.menu' | t"
        (close)="back.emit()"
      />
    } @else {
      <feat-lazy-bac-game-screen-header
        [title]="'replay.viewer.title' | t"
        (back)="back.emit()"
      />
      <section class="matches" [attr.aria-label]="'replay.viewer.title' | t">
        <p>{{ 'replay.matches.unreadable' | t }}</p>
      </section>
    }
  `,
  styleUrl: './replay-screen.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReplayScreenComponent {
  private readonly evolution = inject(EvolutionService);
  /** The GPU that passed the self-test, which GPU replays play on. */
  protected readonly trustedGpu = inject(GpuSelfTestService).trustedRenderer;

  private readonly recording = inject(GameStateService).lastRecording;

  public readonly back = output<void>();

  /** The recording of the match that ended last. */
  protected readonly replay = computed(() => this.recording()?.replay ?? null);
  protected readonly look = this.evolution.worn;
}
