import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RenderShader2Component } from './render-shader-2.component';
import { WebglService } from './render-shader.service';

jest.mock('@wolsok/ws-gl', () => {
  const actual = jest.requireActual('@wolsok/ws-gl');
  return {
    ...actual,
    WebGl2Renderer: class MockRenderer {
      render = jest.fn();
    },
  };
});

class WebglServiceMock {
  initializeWebGL = jest.fn().mockReturnValue(true);
  renderImage = jest.fn();
  render = jest.fn();
}

describe('RenderShader2Component', () => {
  let fixture: ComponentFixture<RenderShader2Component>;
  let component: RenderShader2Component;
  let service: WebglServiceMock;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RenderShader2Component],
      providers: [{ provide: WebglService, useClass: WebglServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(RenderShader2Component);
    component = fixture.componentInstance;
    service = TestBed.inject(WebglService) as unknown as WebglServiceMock;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize webgl on after view init', () => {
    fixture.detectChanges();
    expect(service.initializeWebGL).toHaveBeenCalled();
  });
});
