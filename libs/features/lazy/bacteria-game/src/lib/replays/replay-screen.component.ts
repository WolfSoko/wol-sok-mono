import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
} from '@angular/core';
import { EvolutionService } from '../evolution.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ScreenHeaderComponent } from '../menu/screen-header.component';
import { GameStateService } from '../state/game-state.service';
import { ReplayViewerComponent } from './replay-viewer.component';

/**
 * The match just played, watched again from its result (ADR 0011): the
 * replay viewer on the recording the match left, then back to the menu.
 */
@Component({
  selector: 'feat-lazy-bac-game-replay-screen',
  imports: [ReplayViewerComponent, ScreenHeaderComponent, TranslatePipe],
  template: `
    <feat-lazy-bac-game-screen-header
      [title]="'replay.viewer.title' | t"
      (back)="back.emit()"
    />
    <section class="matches" [attr.aria-label]="'replay.viewer.title' | t">
      @if (replay(); as replay) {
        <feat-lazy-bac-game-replay-viewer
          [replay]="replay"
          [look]="look()"
          [label]="'replay.viewer.title' | t"
        />
      } @else {
        <p>{{ 'replay.matches.unreadable' | t }}</p>
      }
    </section>
  `,
  styleUrl: './my-matches.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReplayScreenComponent {
  private readonly evolution = inject(EvolutionService);

  private readonly recording = inject(GameStateService).lastRecording;

  public readonly back = output<void>();

  /** The recording of the match that ended last. */
  protected readonly replay = computed(() => this.recording()?.replay ?? null);
  protected readonly look = this.evolution.worn;
}
