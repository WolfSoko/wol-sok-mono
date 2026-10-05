import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { PageEvent } from '@angular/material/paginator';
import { ShaderCode } from '../model/shader-code.model';

/** The paging state we keep; a plain object, not a `PageEvent` instance. */
export type PageState = Pick<
  PageEvent,
  'length' | 'pageIndex' | 'pageSize' | 'previousPageIndex'
>;

export interface ShaderExampleState {
  showFps: boolean;
  showCodeEditor: boolean;
  currentPage: PageState;
  isSmallScreen: boolean;
  pagedShaders: ShaderCode[];
  animationState: '' | 'fadeOutRight' | 'fadeOutLeft';
  savingShader: boolean;
}

export function createInitialShaderExampleState(): ShaderExampleState {
  return {
    showFps: false,
    showCodeEditor: false,
    isSmallScreen: false,
    currentPage: {
      length: 0,
      pageIndex: 0,
      pageSize: 2,
    },
    pagedShaders: [],
    animationState: '',
    savingShader: false,
  };
}

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'shader-examples' })
export class ShaderExamplesUIStore extends Store<ShaderExampleState> {
  constructor() {
    super(createInitialShaderExampleState());
  }
}
