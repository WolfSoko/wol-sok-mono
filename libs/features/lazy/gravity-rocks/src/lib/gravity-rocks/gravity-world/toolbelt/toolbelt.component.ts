import {
  ChangeDetectionStrategy,
  Component,
  input,
  InputSignal,
  model,
  ModelSignal,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ObjectKind, OBJECT_KINDS, Tool, TOOLS } from './tools';

/**
 * The tools laid out down the left edge of the world: what a press does, what
 * the add tool puts down, and a line of guidance for a tool that is in the
 * middle of something.
 *
 * It knows the tools and nothing about the world. Picking one is reported
 * rather than acted on: dropping whatever the last tool had half-finished is
 * the world's business, not the belt's.
 */
@Component({
  selector: 'feat-lazy-gravity-toolbelt',
  templateUrl: 'toolbelt.component.html',
  styleUrls: ['toolbelt.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonToggleModule, MatIconModule, MatTooltipModule],
})
export class ToolbeltComponent {
  /** The tool in hand. */
  readonly tool: ModelSignal<Tool> = model.required<Tool>();
  /** What the add tool puts down. */
  readonly addKind: ModelSignal<ObjectKind> = model.required<ObjectKind>();
  /** What the tool in hand wants next, if it is waiting for something. */
  readonly hint: InputSignal<string | null> = input<string | null>(null);

  readonly tools = TOOLS;
  readonly objectKinds = OBJECT_KINDS;
}
