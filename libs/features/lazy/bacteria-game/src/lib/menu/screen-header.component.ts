import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * The head of a menu sub screen: the way back, the screen's title, and
 * whatever controls the screen puts after them.
 */
@Component({
  selector: 'feat-lazy-bac-game-screen-header',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <button mat-stroked-button type="button" class="back" (click)="back.emit()">
      <mat-icon>arrow_back</mat-icon>
      {{ backLabel() }}
    </button>
    <h2 class="screen-title">{{ title() }}</h2>
    <ng-content />
  `,
  styleUrl: './screen-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScreenHeaderComponent {
  public readonly title = input.required<string>();
  /** Names where the way back leads. */
  public readonly backLabel = input('Menu');

  public readonly back = output<void>();
}
