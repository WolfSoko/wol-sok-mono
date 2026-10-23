import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { TranslatePipe } from '../i18n/translate.pipe';
import { LevelPreviewService } from './level-preview.service';
import { levelColors } from './menu-cards';

/**
 * The map of a level as a small picture - drawn from the level's data, see
 * `arena/level-preview.ts` - with a badge on a map bigger than the screen.
 * Until the picture is drawn it shows the arena's colours. Hosts show it
 * only where previews are supported (`LevelPreviewService.supported`).
 */
@Component({
  selector: 'feat-lazy-bac-game-level-preview',
  imports: [TranslatePipe],
  templateUrl: './level-preview.component.html',
  styleUrl: './level-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--preview-floor]': 'colors().floor',
    '[style.--preview-edge]': 'colors().edge',
  },
})
export class LevelPreviewComponent {
  private readonly previews = inject(LevelPreviewService);

  public readonly levelId = input.required<string>();
  /** The level's title in the active language, for the picture's text. */
  public readonly title = input.required<string>();
  /** How many times the base arena the map is along each side. */
  public readonly size = input(1);
  /**
   * True inside a control that names the level already - a level card -
   * where the picture and its badge stay out of the accessible name.
   */
  public readonly decorative = input(false, { transform: booleanAttribute });

  protected readonly url = computed(() => this.previews.url(this.levelId()));
  protected readonly colors = computed(() => levelColors(this.levelId()));
}
