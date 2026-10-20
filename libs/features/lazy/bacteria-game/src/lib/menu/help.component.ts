import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { cssTriple } from '../arena/arena-theme';
import { ZONE_COLORS } from '../arena/zone-look';
import { ZoneKind } from '../state/zones';
import { ScreenHeaderComponent } from './screen-header.component';

/** What each kind of ground does, for the rules. */
const ZONE_RULES: readonly { kind: ZoneKind; name: string; rule: string }[] = [
  { kind: 'agar', name: 'Agar', rule: 'bacteria divide twice as fast.' },
  {
    kind: 'antibiotic',
    name: 'Antibiotic',
    rule: 'drains energy - linger and your bacteria die.',
  },
  { kind: 'ice', name: 'Ice', rule: 'bacteria crawl at half the speed.' },
  { kind: 'heat', name: 'Heat', rule: 'bacteria go for the enemy harder.' },
];

/**
 * How to play: the rules in three steps, the ground some levels lay out,
 * the keys and the touch layout.
 */
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

  protected readonly zones = ZONE_RULES.map((zone) => ({
    ...zone,
    css: `rgb(${cssTriple(ZONE_COLORS[zone.kind])})`,
  }));
}
