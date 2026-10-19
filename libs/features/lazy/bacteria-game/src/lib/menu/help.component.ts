import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { ScreenHeaderComponent } from './screen-header.component';

/** How to play: the rules in three steps, the keys and the touch layout. */
@Component({
  selector: 'feat-lazy-bac-game-help',
  imports: [ScreenHeaderComponent],
  templateUrl: './help.component.html',
  styleUrl: './help.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpComponent {
  /** The names of the left and the right colour, for the keys. */
  public readonly colorNames = input.required<readonly string[]>();

  public readonly back = output<void>();
}
