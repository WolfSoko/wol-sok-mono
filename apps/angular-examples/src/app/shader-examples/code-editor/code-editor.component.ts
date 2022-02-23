import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from "@angular/core";

@Component({
  selector: 'app-code-editor',
  templateUrl: './code-editor.component.html',
  styleUrls: ['./code-editor.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CodeEditorComponent {

  private codeValue = '';

  @Input() mode!: string;

  @Input() get code(): string {
    return this.codeValue;
  }

  set code(code) {
    this.codeValue = code;
    this.codeChange.emit(code);
  }

  @Input() codeTitle?: string;

  @Output() codeChange: EventEmitter<string> = new EventEmitter<string>();

  options: { printMargin: boolean; maxLines: number } = {maxLines: 1000, printMargin: false};

}
