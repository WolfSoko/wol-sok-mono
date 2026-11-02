import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { WeaponId } from '../state/evolution';

/**
 * A weapon's card demo: a small dish in which the weapon plays on a few
 * bacteria, looped - in the colour the card sets as `--weapon`.
 */
@Component({
  selector: 'feat-lazy-bac-game-weapon-demo',
  imports: [MatIconModule],
  template: `
    <span class="zone"></span>
    @for (n of bacs; track n) {
      <span class="bac" [class.foe]="n % 2 === 1"></span>
    }
    <mat-icon class="demo-icon">{{ icon() }}</mat-icon>
  `,
  styleUrl: './weapon-demo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[attr.data-weapon]': 'weapon()',
    '[attr.data-weapon-demo]': 'weapon()',
  },
})
export class WeaponDemoComponent {
  public readonly weapon = input.required<WeaponId>();
  public readonly icon = input.required<string>();

  protected readonly bacs = [0, 1, 2, 3, 4, 5];
}
