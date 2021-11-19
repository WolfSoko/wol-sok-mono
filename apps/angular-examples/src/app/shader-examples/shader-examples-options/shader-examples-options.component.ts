import { Component } from '@angular/core';
import { ShaderExamplesService, ShaderExamplesUIQuery } from '../state';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-shader-examples-options',
  templateUrl: './shader-examples-options.component.html',
  styleUrls: ['./shader-examples-options.component.scss']
})
export class ShaderExamplesOptionsComponent {
  readonly isLoading: Observable<boolean>;
  readonly showFps: Observable<boolean>;
  readonly showCodeEditor: Observable<boolean>;

  constructor(private shaderExamplesQuery: ShaderExamplesUIQuery, private shaderExamplesService: ShaderExamplesService) {
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
