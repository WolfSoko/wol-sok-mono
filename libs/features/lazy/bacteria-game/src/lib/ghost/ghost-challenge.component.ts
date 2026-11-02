import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GameTextPipe, levelNameText } from '../i18n/game-texts';
import { TranslatePipe } from '../i18n/translate.pipe';
import { Level } from '../state/levels';

/**
 * The offer of a run someone shared: a ghost to fight on its level. A dumb
 * component - it shows the level and reports the answer.
 */
@Component({
  selector: 'feat-lazy-bac-game-ghost-challenge',
  imports: [GameTextPipe, MatButtonModule, MatIconModule, TranslatePipe],
  templateUrl: './ghost-challenge.component.html',
  styleUrl: './ghost-challenge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GhostChallengeComponent {
  /** The level the shared run was played on. */
  public readonly level = input.required<Level>();

  public readonly fight = output<void>();
  public readonly dismiss = output<void>();

  protected readonly levelNameText = levelNameText;
}
