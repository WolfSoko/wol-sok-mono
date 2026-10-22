import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MedallionComponent } from '../medallion/medallion.component';
import { BotDifficulty } from '../state/bot-controller';
import { MedalTier } from '../state/medallions';

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
  /** Its medallion per difficulty, empty where it keeps none. */
  medals: readonly { difficulty: BotDifficulty; tier: MedalTier | null }[];
}

/** One level of the level choice, in its arena's colours. */
@Component({
  selector: 'feat-lazy-bac-game-level-card',
  imports: [MatIconModule, MedallionComponent],
  templateUrl: './level-card.component.html',
  styleUrl: './level-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LevelCardComponent {
  public readonly card = input.required<LevelCard>();
  /** True for the level the match will be played on. */
  public readonly current = input(false);
  public readonly showMedals = input(true);

  public readonly pick = output<string>();
}
