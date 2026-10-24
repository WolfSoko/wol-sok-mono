import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../i18n/translate.pipe';
import { MedallionComponent } from '../medallion/medallion.component';
import { BotDifficulty } from '../state/bot-controller';
import { MedalTier } from '../state/medallions';
import { LevelPreviewComponent } from './level-preview.component';
import { LevelPreviewService } from './level-preview.service';

/** What a level card shows. */
export interface LevelCard {
  id: string;
  /** Its place on the ladder, or the style of a generated level. */
  badge: string;
  title: string;
  /** Why it is locked, null while it is open. */
  lock: string | null;
  /** The arena's floor and frame, as CSS colour triples. */
  floor: string;
  edge: string;
  /** How many times the base arena its map is along each side. */
  size: number;
  /** Its medallion per difficulty, empty where it keeps none. */
  medals: readonly { difficulty: BotDifficulty; tier: MedalTier | null }[];
}

/**
 * One level of the level choice: a picture of its map where previews are
 * drawn, else just its arena's colours.
 */
@Component({
  selector: 'feat-lazy-bac-game-level-card',
  imports: [
    LevelPreviewComponent,
    MatIconModule,
    MedallionComponent,
    TranslatePipe,
  ],
  templateUrl: './level-card.component.html',
  styleUrl: './level-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LevelCardComponent {
  /** True where the card shows a picture of the level's map. */
  protected readonly previews = inject(LevelPreviewService).supported;

  public readonly card = input.required<LevelCard>();
  /** True for the level the match will be played on. */
  public readonly current = input(false);
  public readonly showMedals = input(true);

  public readonly pick = output<string>();
}
