import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { BrainSettingsComponent } from '../shared/brain-settings/brain-settings.component';
import { BrainService, LabelDefinition } from '../shared/brain.service';
import { DataViewComponent } from '../shared/data-view/data-view.component';
import { NetworkViewComponent } from '../shared/network-view/network-view.component';
import { Point } from '../shared/point';

const circleLabel: LabelDefinition = (x, y) =>
  (x - 0.5) ** 2 + (y - 0.5) ** 2 < 0.3 ** 2 ? 1 : 0;

@Component({
  selector: 'feat-lazy-neural-networks-multi-perceptron',
  templateUrl: './multi-perceptron.component.html',
  styleUrls: ['./multi-perceptron.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCardModule,
    DataViewComponent,
    NetworkViewComponent,
    BrainSettingsComponent,
  ],
})
export class MultiPerceptronComponent implements OnInit {
  private brainService = inject(BrainService);

  width = 400;
  height = 400;
  perceptronPerLayer = [8, 1];

  get layers() {
    return this.brainService.perceptrons;
  }

  get outputPerceptron() {
    return this.layers[this.layers.length - 1][0];
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
    this.brainService.labelDefinition = circleLabel;
    this.brainService.createMultiPerceptron(2, this.perceptronPerLayer);
    this.brainService.updateTrainingData();
  }

  addPoint({ x, y, click }: { x: number; y: number; click: 'left' | 'right' }) {
    const point = new Point(x / this.width, y / this.height, () =>
      click === 'left' ? 1 : 0
    );
    this.brainService.addPoint(point);
  }
}
