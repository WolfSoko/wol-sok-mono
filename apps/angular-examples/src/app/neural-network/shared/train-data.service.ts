import { Injectable } from '@angular/core';
import { Point } from './point';

@Injectable({ providedIn: 'root' })
export class TrainDataService {
  createTestData(amount: number): Point[] {
    const points = [];

    for (let i = 0; i < amount; i++) {
      points[i] = new Point();
    }

    return points;
  }
}
