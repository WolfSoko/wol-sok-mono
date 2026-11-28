import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
// brace defines the global `ace` its modes register with, so it comes first
import 'brace';
import 'brace/mode/glsl';
import { AceEditorDirective, AceEditorModule } from 'ngx-ace-editor-wrapper';

/** how long the editor waits after the last keystroke before `codeChange` */
const DEFAULT_CHANGE_DEBOUNCE_MS = 1000;
/** the editor grows with its code up to this many lines, then scrolls */
const MAX_LINES = 1000;

/**
 * An Ace code editor in the Monokai theme that grows with its code.
 * GLSL is highlighted; another `mode` needs its `brace/mode/<mode>` import.
 */
@Component({
  selector: 'ws-shared-ui-code-editor',
  imports: [AceEditorModule],
  templateUrl: './code-editor.component.html',
  styleUrl: './code-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodeEditorComponent {
  /** the code shown; edits come back through `codeChange` */
  public readonly code = input('');
  /** Ace's language mode, say `'glsl'` */
  public readonly mode = input('glsl');
  /** a title above the editor, none when unset */
  public readonly codeTitle = input<string>();
  /** ms after the last edit until `codeChange` fires; 0 fires on every edit */
  public readonly changeDebounceMs = input(DEFAULT_CHANGE_DEBOUNCE_MS);
  /** how many lines the editor is tall at least, however short the code */
  public readonly minLines = input(1);
  /** the edited code */
  public readonly codeChange = output<string>();

  protected readonly options = computed(() => ({
    minLines: this.minLines(),
    maxLines: MAX_LINES,
    printMargin: false,
  }));

  private readonly ace = viewChild.required(AceEditorDirective);

  public constructor() {
    // an edit still waiting for the old debounce would arrive after newer
    // ones: a new debounce sends it at once
    effect(() => {
      this.changeDebounceMs();
      this.sendPendingChange(this.ace());
    });
  }

  private sendPendingChange(ace: AceEditorDirective): void {
    if (ace.timeoutSaving == null) {
      return;
    }
    clearTimeout(ace.timeoutSaving);
    ace.timeoutSaving = null;
    const code = ace.aceEditor.getValue();
    // as the wrapper's own timer would, so it takes the code back unchanged
    ace._text = code;
    this.codeChange.emit(code);
  }
}
