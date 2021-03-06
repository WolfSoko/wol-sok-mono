import { Injectable } from '@angular/core';
import { Circle } from './circle';
import { Line } from './line';
import { Vector } from './vector';

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

  public createCircle(vec: Vector, radius: number): Circle {
    return new Circle(vec, radius);
  }

  public createLine(from: Vector, to: Vector): Line {
    return new Line(from, to);
  }
}
