import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { BrainSettingsComponent } from '../shared/brain-settings/brain-settings.component';
import { BrainService } from '../shared/brain.service';
import { DataViewComponent } from '../shared/data-view/data-view.component';
import { PerceptronComponent } from '../shared/perceptron/perceptron.component';
import { Point } from '../shared/point';

@Component({
  selector: 'feat-lazy-neural-networks-multi-perceptron',
  templateUrl: './multi-perceptron.component.html',
  styleUrls: ['./multi-perceptron.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatCardModule,
    DataViewComponent,
    PerceptronComponent,
    BrainSettingsComponent,
  ],
})
export class MultiPerceptronComponent implements OnInit {
  width = 300;
  height = 300;
  perceptronPerLayer = [2, 3, 1];

  constructor(private brainService: BrainService) {}

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

  ngOnInit() {
    this.brainService.createMultiPerceptron(2, this.perceptronPerLayer);
  }

  addPoint({ x, y, click }: { x: number; y: number; click: 'left' | 'right' }) {
    const point = new Point(x / this.width, y / this.height, () =>
      click === 'left' ? 1 : 0
    );
    this.brainService.addPoint(point);
  }
}
