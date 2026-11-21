import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BlogFigureComponent } from '../../blog-figure.component';
import { TURN_RELAY_FIGURES } from './figures';
import { TURN_RELAY_SNIPPETS } from './snippets';

/** The text of the TURN relay article in English. */
@Component({
  selector: 'wolsok-turn-relay-en',
  imports: [BlogFigureComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './turn-relay-en.component.html',
  styleUrl: '../../blog-prose.scss',
})
export class TurnRelayEnComponent {
  protected readonly figures = TURN_RELAY_FIGURES;
  protected readonly code = TURN_RELAY_SNIPPETS;
}
