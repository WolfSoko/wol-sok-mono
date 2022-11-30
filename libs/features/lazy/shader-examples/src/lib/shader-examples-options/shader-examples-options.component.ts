import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Observable } from 'rxjs';
import { ShaderExamplesService, ShaderExamplesUIQuery } from '../state';

@Component({
  standalone: true,
  imports: [CommonModule, MatCheckboxModule, FormsModule],
  selector: 'lzy-ft-shad-ex-options',
  templateUrl: './shader-examples-options.component.html',
  styleUrls: ['./shader-examples-options.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShaderExamplesOptionsComponent {
  readonly isLoading: Observable<boolean>;
  readonly showFps: Observable<boolean>;
  readonly showCodeEditor: Observable<boolean>;

  constructor(
    private shaderExamplesQuery: ShaderExamplesUIQuery,
    private shaderExamplesService: ShaderExamplesService
  ) {
    this.isLoading = this.shaderExamplesQuery.selectLoading();
    this.showFps = this.shaderExamplesQuery.showFps;
    this.showCodeEditor = this.shaderExamplesQuery.showCodeEditor;
  }

  toggleShowFPS() {
    this.shaderExamplesService.toggleShowFps();
  }

  toggleShowCodeEditor() {
    this.shaderExamplesService.toggleShowEditor();
  }
}
