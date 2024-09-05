import { Injectable } from '@angular/core';
import { Circle } from '../../domain/model/circle';
import { Line } from '../../domain/model/line';
import { Vector } from '../../domain/model/vector';

@Injectable({ providedIn: 'root' })
export class CanvasDrawService {
  private ctx?: CanvasRenderingContext2D;
  private offscreenCtx?: CanvasRenderingContext2D;
  private currentCtx!: CanvasRenderingContext2D;

  initCtx(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.currentCtx = ctx;
    // create a second canvas from ctx as a buffer for drawing static objects
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = ctx.canvas.width;
    offscreenCanvas.height = ctx.canvas.height;

    this.offscreenCtx = offscreenCanvas.getContext('2d') ?? undefined;
    return this;
  }

  useOffscreen() {
    if (!this.offscreenCtx) {
      throw new Error('No offscreen context found');
    }
    this.currentCtx = this.offscreenCtx;
    return this;
  }

  useMain() {
    if (!this.ctx) {
      throw new Error('No main context found');
    }
    this.currentCtx = this.ctx;
    return this;
  }

  setFillColor(fillColor: string) {
    this.currentCtx.fillStyle = fillColor;
    return this;
  }

  setStrokeColor(strokeColor: string) {
    this.currentCtx.strokeStyle = strokeColor;
    return this;
  }

  drawCircle(circle: Circle): CanvasDrawService {
    const offsetX = 0;
    const offsetY = 0;

    return this.setFillColor('#009F10').drawPoint(
      circle.pos.x + offsetX,
      circle.pos.y + offsetY,
      circle.r
    );
  }

  drawVec(vec: Vector, radius: number) {
    return this.drawPoint(vec.x, vec.y, radius);
  }

  drawPoint(x: number, y: number, radius: number) {
    return this.drawArc(x, y, radius, 0, 2 * Math.PI, true);
  }

  drawLineObj(line: Line) {
    return this.drawLine(line.from, line.to);
  }

  drawLine(from: Vector, to: Vector) {
    this.currentCtx?.beginPath();
    this.currentCtx?.moveTo(from.x, from.y);
    this.currentCtx?.lineTo(to.x, to.y);
    this.currentCtx?.stroke();
    return this;
  }

  drawArc(
    x: number,
    y: number,
    r: number,
    startAngle: number,
    endAngle: number,
    anticlockwise: boolean
  ) {
    this.currentCtx?.beginPath();
    this.currentCtx?.arc(x, y, r, startAngle, endAngle, anticlockwise);
    this.currentCtx?.fill();
    return this;
  }

  fillRect(x: number, y: number, width: number, height: number) {
    this.currentCtx?.fillRect(x, y, width, height);
    return this;
  }

  mergeOffscreenCanvas() {
    if (!this.ctx || !this.offscreenCtx) {
      throw new Error('No context found');
    }
    this.ctx.drawImage(this.offscreenCtx.canvas, 0, 0);
    return this;
  }
}
