import { createComponentFactory } from '@ngneat/spectator';
import { RenderShader2Component } from './render-shader-2.component';
import { WebglService } from './render-shader.service';

describe('Integration-Test: RenderShader2', () => {
  const create = createComponentFactory({
    component: RenderShader2Component,
    providers: [WebglService],
  });

  it('should create', () => {
    expect(create().component).toBeTruthy();
  });
});
