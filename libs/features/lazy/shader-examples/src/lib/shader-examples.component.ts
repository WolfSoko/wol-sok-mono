import { animate, keyframes, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RenderShaderComponent } from '@wolsok/ui-kit';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CodeEditorComponent } from './code-editor/code-editor.component';
import { fadeInLeft, fadeInRight, fadeOutLeft, fadeOutRight } from './leftInOut.animation';
import { ShaderExamplesOptionsComponent } from './shader-examples-options/shader-examples-options.component';
import { ShaderCode, ShaderCodeQuery, ShaderExamplesService, ShaderExampleState, ShaderExamplesUIQuery } from './state';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    CodeEditorComponent,
    ShaderExamplesOptionsComponent,
    RenderShaderComponent,
    MatCardModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatPaginatorModule,
    MatIconModule,
  ],
  selector: 'lzy-ft-shad-ex-shader-examples',
  templateUrl: './shader-examples.component.html',
  styleUrls: ['./shader-examples.component.scss'],
  animations: [
    trigger('animator', [
      transition('void => *', animate(1000, keyframes(fadeInRight))),
      transition('* => fadeOutLeft', animate(200, keyframes(fadeOutLeft))),
      transition('* => fadeOutRight', animate(200, keyframes(fadeOutRight))),
      transition('fadeOutRight => *', animate(400, keyframes(fadeInLeft))),
      transition('fadeOutLeft => *', animate(400, keyframes(fadeInRight))),
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShaderExamplesComponent {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  readonly viewModel$: Observable<ShaderExampleState & { isLoadingShaders: boolean }>;

  constructor(
    readonly state: ShaderExamplesUIQuery,
    readonly shaderCodeQuery: ShaderCodeQuery,
    private readonly shaderExamplesService: ShaderExamplesService
  ) {
    this.viewModel$ = combineLatest([this.state.select(), shaderCodeQuery.selectLoading()]).pipe(
      map(([state, isLoadingShaders]) => ({
        ...state,
        isLoadingShaders,
      }))
    );
  }

  changeCurrentShaderPage($event: PageEvent) {
    this.shaderExamplesService.updateCurrentPage($event);
  }

  trackByIndex(index: number) {
    return index;
  }

  previousPage() {
    if (this.paginator) {
      this.startAnimation('fadeOutRight');
      if (this.paginator.hasPreviousPage()) {
        this.paginator.previousPage();
      } else {
        this.paginator.lastPage();
      }
    }
  }

  nextPage() {
    if (this.paginator) {
      this.startAnimation('fadeOutLeft');
      if (this.paginator.hasNextPage()) {
        this.paginator.nextPage();
      } else {
        this.paginator.firstPage();
      }
    }
  }

  startAnimation(state: 'fadeOutRight' | 'fadeOutLeft') {
    this.shaderExamplesService.updateAnimationState(state);
  }

  resetAnimationState() {
    this.shaderExamplesService.updateAnimationState('');
  }

  updateShaderCode(shader: ShaderCode, code: string) {
    this.shaderExamplesService.updateShaderCode(shader, code);
  }
}
