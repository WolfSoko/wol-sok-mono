import { Injectable } from '@angular/core';
import { Circle } from './model/circle';
import { Line } from './model/line';
import { Vector } from './model/vector';

@Injectable({ providedIn: 'root' })
export class ShapeFactoryService {
  public randomVector() {
    const a = Math.random() * 2 * Math.PI;
    const offsetX = Math.cos(a);
    const offsetY = Math.sin(a);
    return new Vector(offsetX, offsetY).unit();
  }

  public createVector(x: number, y: number): Vector {
    return new Vector(x, y);
  }

  public createCircle(pos: Vector, radius: number): Circle {
    return new Circle(pos, radius);
  }

  public createLine(from: Vector, to: Vector): Line {
    return new Line(from, to);
  }
}
