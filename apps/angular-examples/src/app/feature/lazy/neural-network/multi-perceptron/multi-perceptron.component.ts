import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Point } from '../shared/point';
import { BrainService } from '../shared/brain.service';

@Component({
  selector: 'app-multi-perceptron',
  templateUrl: './multi-perceptron.component.html',
  styleUrls: ['./multi-perceptron.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultiPerceptronComponent implements OnInit {
  width = 300;
  height = 300;
  perceptronPerLayer = [2, 3, 1];

  constructor(private brainService: BrainService) {}

  ngOnInit() {
    this.brainService.createMultiPerceptron(2, this.perceptronPerLayer);
  }

  get perceptron() {
    return this.brainService.perceptrons;
  }

  get inputPerceptron() {
    return this.perceptron[0];
  }

  get hiddenPerceptron() {
    return this.perceptron[1];
  }

  get outputPerceptron() {
    return this.perceptron[this.perceptron.length - 1][0];
  }

  get learnedDataPoints() {
    return this.brainService.learnedDataPoints;
  }

  get learnRate() {
    return this.brainService.learnRate;
  }

  get points() {
    return this.brainService.points;
  }

  addPoint({ x, y, click }: { x: number; y: number; click: 'left' | 'right' }) {
    const point = new Point(x / this.width, y / this.height, () => (click === 'left' ? 1 : 0));
    this.brainService.addPoint(point);
  }
}
