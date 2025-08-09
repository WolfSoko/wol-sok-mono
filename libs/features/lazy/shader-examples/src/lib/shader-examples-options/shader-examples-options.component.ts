import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Observable } from 'rxjs';
import { ShaderExamplesService, ShaderExamplesUIQuery } from '../state';

@Component({
  imports: [CommonModule, MatCheckboxModule, FormsModule],
  selector: 'lzy-ft-shad-ex-options',
  templateUrl: './shader-examples-options.component.html',
  styleUrls: ['./shader-examples-options.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShaderExamplesOptionsComponent {
  private shaderExamplesQuery = inject(ShaderExamplesUIQuery);
  private shaderExamplesService = inject(ShaderExamplesService);

  readonly isLoading: Observable<boolean>;
  readonly showFps: Observable<boolean>;
  readonly showCodeEditor: Observable<boolean>;

  constructor() {
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
