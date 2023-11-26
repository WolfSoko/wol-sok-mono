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
      this.webglService.renderImage(image);
      this.startLoop();
    };
    image.src = howToBeFunnyPng; // Pfad zu deinem Bild
  }

  private startLoop(startTime = performance.now()): void {
    requestAnimationFrame((time) => {
      const deltaTime = (time - startTime) / 1000;
      this.webglService.render(deltaTime);
      this.startLoop(startTime);
    });
  }
}
