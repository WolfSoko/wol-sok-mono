import { Injectable } from '@angular/core';
import { Circle } from '../../shared/circle';
import { Line } from '../../shared/line';
import { Vector } from '../../shared/vector';

@Injectable({ providedIn: 'root' })
export class CanvasDrawService {
  private ctx?: CanvasRenderingContext2D;

  initCtx(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    return this;
  }

  setFillColor(fillColor: string) {
    if (this.ctx) {
      this.ctx.fillStyle = fillColor;
    }
    return this;
  }

  setStrokeColor(strokeColor: string) {
    if (this.ctx) {
      this.ctx.strokeStyle = strokeColor;
    }
    return this;
  }

  setLineWidth(lineWidth: number) {
    if (this.ctx) {
      this.ctx.lineWidth = lineWidth;
    }
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  drawCircle(circle: Circle, _step: number): CanvasDrawService {
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
    this.ctx?.beginPath();
    this.ctx?.moveTo(from.x, from.y);
    this.ctx?.lineTo(to.x, to.y);
    this.ctx?.stroke();
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  drawPath(points: Vector[], colorFn?: (vec: Vector) => string) {
    this.ctx?.moveTo(points[0].x, points[0].y);
    this.ctx?.beginPath();
    points.forEach((vec) => this.ctx?.lineTo(vec.x, vec.y));
    this.ctx?.closePath();
    this.ctx?.stroke();
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
    this.ctx?.beginPath();
    this.ctx?.arc(x, y, r, startAngle, endAngle, anticlockwise);
    this.ctx?.fill();
    return this;
  }

  clear(width: number, height: number) {
    return this.setFillColor('black').fillRect(0, 0, width, height);
  }

  fillRect(x: number, y: number, width: number, height: number) {
    this.ctx?.fillRect(x, y, width, height);
    return this;
  }
}
