import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  @ViewChild('glCanvas') private canvasRef?: ElementRef;
  constructor(private webglService: WebglService) {}

  ngAfterViewInit() {
    const canvas: HTMLCanvasElement = this.canvasRef?.nativeElement;
    if (!canvas) {
      throw new Error('could not find glCanvas');
    }
    if (this.webglService.initializeWebGL(canvas)) {
      this.loadAndRenderImage();
    }
  }

  private loadAndRenderImage() {
    const image = new Image();
    image.onload = () => {
      const imageData = this.getImageData(image);
      this.webglService.renderImage(imageData);
      this.startLoop();
    };
    image.src = howToBeFunnyPng; // Pfad zu deinem Bild
  }

  private getImageData(image: HTMLImageElement): ImageData {
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = image.width;
    offscreenCanvas.height = image.height;

    const ctx = offscreenCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not create 2d context for offsetCanvas');
    }
    ctx.drawImage(image, 0, 0);

    return ctx.getImageData(0, 0, image.width, image.height);
  }

  private startLoop(startTime = performance.now()): void {
    requestAnimationFrame((time) => {
      const deltaTime = (time - startTime) / 1000;
      this.webglService.render(deltaTime);
      this.startLoop(startTime);
    });
  }
}
