import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { rgba } from '../arena/canvas-math';
import { ZONE_COLORS } from '../arena/zone-look';
import { ZONE_EFFECTS, ZoneKind } from '../state/zones';
import { ScreenHeaderComponent } from './screen-header.component';

const { agarDivideFactor, iceStayChance } = ZONE_EFFECTS;

/** "twice", "3 times". */
function timesAsFast(factor: number): string {
  return factor === 2 ? 'twice' : `${String(factor)} times`;
}

/** What each kind of ground does, for the rules - every kind has one. */
const ZONE_RULES: Readonly<Record<ZoneKind, { name: string; rule: string }>> = {
  agar: {
    name: 'Agar',
    rule: `bacteria divide ${timesAsFast(agarDivideFactor)} as fast.`,
  },
  antibiotic: {
    name: 'Antibiotic',
    rule: 'drains energy - linger and your bacteria die.',
  },
  ice: {
    name: 'Ice',
    rule: `bacteria crawl at ${Math.round((1 - iceStayChance) * 100)} % of their speed.`,
  },
  heat: { name: 'Heat', rule: 'bacteria go for the enemy harder.' },
};

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

  protected readonly zones = Object.entries(ZONE_RULES).map(([kind, zone]) => ({
    kind,
    ...zone,
    css: rgba(ZONE_COLORS[kind as ZoneKind]),
  }));
}
