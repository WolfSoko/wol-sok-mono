import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../i18n/translate.pipe';

/**
 * The head of a menu sub screen: the way back, the screen's title, and
 * whatever controls the screen puts after them.
 */
@Component({
  selector: 'feat-lazy-bac-game-screen-header',
  imports: [MatButtonModule, MatIconModule, TranslatePipe],
  template: `
    <button mat-stroked-button type="button" class="back" (click)="back.emit()">
      <mat-icon>arrow_back</mat-icon>
      {{ backLabel() ?? ('common.menu' | t) }}
    </button>
    <h2 class="screen-title">{{ title() }}</h2>
    <ng-content />
  `,
  styleUrl: './screen-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScreenHeaderComponent {
  public readonly title = input.required<string>();
  /** Names where the way back leads - the menu unless told otherwise. */
  public readonly backLabel = input<string | null>(null);

  public readonly back = output<void>();
}
