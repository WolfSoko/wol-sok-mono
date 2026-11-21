import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BlogFigureComponent } from '../../blog-figure.component';
import { TURN_RELAY_FIGURES } from './figures';
import { TURN_RELAY_SNIPPETS } from './snippets';

/** The text of the TURN relay article in German. */
@Component({
  selector: 'wolsok-turn-relay-de',
  imports: [BlogFigureComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './turn-relay-de.component.html',
  styleUrl: '../../blog-prose.scss',
})
export class TurnRelayDeComponent {
  protected readonly figures = TURN_RELAY_FIGURES;
  protected readonly code = TURN_RELAY_SNIPPETS;
}
