import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ColorMaterial,
  Mesh,
  PlaneGeometry,
  Scene,
  WebGl2Renderer,
} from '@wolsok/ws-gl';
import { WebglService } from './render-shader.service';
import howToBeFunnyPng from './testing-assets/how-to-be-funny.png';

@Component({
  selector: 'ws-shared-ui-render-shader-2',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './render-shader-2.component.html',
  styleUrl: './render-shader-2.component.scss',
})
export class RenderShader2Component implements AfterViewInit {
  @ViewChild('glImageCanvas') private imageCanvasRef?: ElementRef;
  @ViewChild('glSceneCanvas') private sceneCanvasRef?: ElementRef;
  private scene?: Scene;
  private renderer?: WebGl2Renderer;
  constructor(private webglService: WebglService) {}

  ngAfterViewInit() {
    const imageCanvasRef: HTMLCanvasElement =
      this.imageCanvasRef?.nativeElement;
    const szeneCanvas: HTMLCanvasElement = this.sceneCanvasRef?.nativeElement;
    if (!imageCanvasRef || !szeneCanvas) {
      throw new Error('could not find glCanvas');
    }
    if (this.webglService.initializeWebGL(imageCanvasRef)) {
      this.loadAndRenderImage();
      this.initScene(szeneCanvas);
    }
  }

  private loadAndRenderImage() {
    const image = new Image();
    image.onload = () => {
      this.webglService.renderImage(image);
      this.startLoop();
    };
    image.src = howToBeFunnyPng; // Pfad zu deinem Bild
  }

  private startLoop(startTime = performance.now()): void {
    requestAnimationFrame((time) => {
      const deltaTime = (time - startTime) / 1000;
      this.webglService.render(deltaTime);
      this.renderer?.render(this.scene!);
      this.startLoop(startTime);
    });
  }

  private initScene(sceneCanvas: HTMLCanvasElement): void {
    this.scene = new Scene();
    for (let i = 0; i < 10; i++) {
      const material = new ColorMaterial(
        Math.random(),
        Math.random(),
        Math.random(),
        1
      );
      const geometry = new PlaneGeometry(
        2 - Math.random() * 2,
        2 - Math.random() * 2,
        Math.random() + Math.random() * 2 - 1,
        Math.random() + Math.random() * 2 - 1
      );
      const mesh = new Mesh(geometry, material);
      this.scene.add(mesh);
    }

    this.renderer = new WebGl2Renderer({
      canvas: sceneCanvas,
      antialias: true,
    });
  }
}
