import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { combineLatest, Observable } from 'rxjs';
import { animate, keyframes, transition, trigger } from '@angular/animations';
import { fadeInLeft, fadeInRight, fadeOutLeft, fadeOutRight } from './leftInOut.animation';
import { ShaderCode, ShaderCodeQuery, ShaderExamplesService, ShaderExampleState, ShaderExamplesUIQuery } from './state';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-shader-examples',
  templateUrl: './shader-examples.component.html',
  styleUrls: ['./shader-examples.component.scss'],
  animations: [
    trigger('animator', [
      transition('void => *', animate(1000, keyframes(fadeInRight))),
      transition('* => fadeOutLeft', animate(200, keyframes(fadeOutLeft))),
      transition('* => fadeOutRight', animate(200, keyframes(fadeOutRight))),
      transition('fadeOutRight => *', animate(400, keyframes(fadeInLeft))),
      transition('fadeOutLeft => *', animate(400, keyframes(fadeInRight)))
    ])
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShaderExamplesComponent {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  readonly viewModel$: Observable<ShaderExampleState & { isLoading: boolean } & { isLoadingShaders: boolean }>;

  constructor(
    readonly state: ShaderExamplesUIQuery,
    readonly shaderCodeQuery: ShaderCodeQuery,
    private readonly shaderExamplesService: ShaderExamplesService
  ) {
    this.viewModel$ = combineLatest([
      this.state.select(),
      this.state.selectLoading(),
      shaderCodeQuery.selectLoading()
    ]).pipe(
      map(([state, isLoading, isLoadingShaders]) => ({
        ...state,
        isLoading,
        isLoadingShaders
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
    this.startAnimation('fadeOutRight');
    if (this.paginator.hasPreviousPage()) {
      this.paginator.previousPage();
    } else {
      this.paginator.lastPage();
    }
  }

  nextPage() {
    this.startAnimation('fadeOutLeft');
    if (this.paginator.hasNextPage()) {
      this.paginator.nextPage();
    } else {
      this.paginator.firstPage();
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
