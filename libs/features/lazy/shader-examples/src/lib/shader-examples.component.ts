import { animate, keyframes, transition, trigger } from '@angular/animations';
import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { MatLegacyPaginator as MatPaginator, LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  fadeInLeft,
  fadeInRight,
  fadeOutLeft,
  fadeOutRight,
} from './leftInOut.animation';
import {
  ShaderCode,
  ShaderCodeQuery,
  ShaderExamplesService,
  ShaderExampleState,
  ShaderExamplesUIQuery,
} from './state';

@Component({
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
  readonly viewModel$: Observable<
    ShaderExampleState & { isLoadingShaders: boolean }
  >;

  constructor(
    readonly state: ShaderExamplesUIQuery,
    readonly shaderCodeQuery: ShaderCodeQuery,
    private readonly shaderExamplesService: ShaderExamplesService
  ) {
    this.viewModel$ = combineLatest([
      this.state.select(),
      shaderCodeQuery.selectLoading(),
    ]).pipe(
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
