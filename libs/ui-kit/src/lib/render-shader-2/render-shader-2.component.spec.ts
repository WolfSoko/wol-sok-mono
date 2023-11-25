import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { RenderShader2Component } from './render-shader-2.component';
import { WebglService } from './render-shader.service';

describe('RenderShader2Component', () => {
  const createComp = createComponentFactory({
    component: RenderShader2Component,
    mocks: [WebglService],
  });

  let spectator: Spectator<RenderShader2Component>;

  beforeEach(async () => {
    spectator = createComp();
  });

  it('should create', () => {
    expect(spectator.component).toBeTruthy();
  });
});
