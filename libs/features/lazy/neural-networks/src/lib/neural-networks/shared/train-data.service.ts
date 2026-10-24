import { Injectable } from '@angular/core';
import { LabelClass, Point } from './point';

@Injectable({ providedIn: 'root' })
export class TrainDataService {
  createTestData(
    amount: number,
    labelDefinition?: (x: number, y: number) => LabelClass
  ): Point[] {
    const points = [];

    for (let i = 0; i < amount; i++) {
      points[i] = new Point(Math.random(), Math.random(), labelDefinition);
    }

    return points;
  }
}
