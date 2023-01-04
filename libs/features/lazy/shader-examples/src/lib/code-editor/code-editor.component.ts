import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { AceEditorModule } from 'ngx-ace-editor-wrapper';

@Component({
  standalone: true,
  imports: [CommonModule, AceEditorModule],
  selector: 'lzy-ft-shad-ex-code-editor',
  templateUrl: './code-editor.component.html',
  styleUrls: ['./code-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  options: { printMargin: boolean; maxLines: number } = {
    maxLines: 1000,
    printMargin: false,
  };
}
