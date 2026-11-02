import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../i18n/translate.pipe';
import { TranslationKey } from '../i18n/dictionaries';
import { MissionId } from '../state/training-levels';

/** A training mission as its row shows it. */
export interface MissionRow {
  id: MissionId;
  icon: string;
  title: TranslationKey;
  goal: TranslationKey;
  /** Its place in the training, from 1. */
  number: number;
  done: boolean;
  /** True for the first mission still to do. */
  upNext: boolean;
}

/**
 * The training's missions, a row each in the order they are played, with
 * how many are done - the training's level step on the new game screen.
 */
@Component({
  selector: 'feat-lazy-bac-game-mission-list',
  imports: [MatIconModule, TranslatePipe],
  templateUrl: './mission-list.component.html',
  styleUrl: './mission-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'region' },
})
export class MissionListComponent {
  public readonly missions = input.required<readonly MissionRow[]>();
  /** The mission picked. */
  public readonly current = input.required<MissionId>();
  public readonly done = input.required<number>();
  public readonly total = input.required<number>();

  public readonly pick = output<MissionId>();
}
