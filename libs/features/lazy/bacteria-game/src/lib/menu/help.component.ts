import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { rgba } from '../arena/canvas-math';
import { ZONE_COLORS } from '../arena/zone-look';
import { ZONE_EFFECTS, ZONE_NAMES, ZoneKind } from '../state/zones';
import { ScreenHeaderComponent } from './screen-header.component';

const { agarDivideFactor, iceStayChance } = ZONE_EFFECTS;

/**
 * The game's privacy policy, on the game's own site: the Play listing links
 * to it as well, and inside the shell a relative link would miss it.
 */
export const PRIVACY_POLICY_URL = 'https://bacteria-game.wolsok.de/privacy';

/** "twice", "3 times". */
function timesAsFast(factor: number): string {
  return factor === 2 ? 'twice' : `${String(factor)} times`;
}

/** What each kind of ground does, for the rules - every kind has one. */
const ZONE_RULES: Readonly<Record<ZoneKind, string>> = {
  agar: `bacteria divide ${timesAsFast(agarDivideFactor)} as fast.`,
  antibiotic: 'drains energy - linger and your bacteria die.',
  ice: `bacteria crawl at ${Math.round((1 - iceStayChance) * 100)} % of their speed.`,
  heat: 'bacteria go for the enemy harder.',
  hill: 'have the most bacteria on it long enough to win.',
};

/**
 * How to play: the rules in three steps, the ground some levels lay out,
 * the keys and the touch layout - and where the privacy policy is.
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

  protected readonly privacyPolicyUrl = PRIVACY_POLICY_URL;

  protected readonly zones = (Object.keys(ZONE_RULES) as ZoneKind[]).map(
    (kind) => ({
      kind,
      name: ZONE_NAMES[kind],
      rule: ZONE_RULES[kind],
      css: rgba(ZONE_COLORS[kind]),
    })
  );
}
