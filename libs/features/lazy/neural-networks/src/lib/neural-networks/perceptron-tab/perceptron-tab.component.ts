import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { ElevateCardDirective } from '@wolsok/ui-kit';
import { Observable } from 'rxjs';
import { BrainSettingsComponent } from '../shared/brain-settings/brain-settings.component';
import { BrainService } from '../shared/brain.service';
import { DataViewComponent } from '../shared/data-view/data-view.component';
import { PerceptronComponent } from '../shared/perceptron/perceptron.component';
import { Point } from '../shared/point';

@Component({
  selector: 'feat-lazy-neural-networks-perceptron-tab',
  templateUrl: './perceptron-tab.component.html',
  styleUrls: ['./perceptron-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCardModule,
    ElevateCardDirective,
    DataViewComponent,
    BrainSettingsComponent,
    PerceptronComponent,
  ],
})
export class PerceptronTabComponent implements OnInit {
  private brainService = inject(BrainService);

  width = 400;
  height = 400;

  autoLearning$: Observable<boolean>;

  constructor() {
    this.autoLearning$ = this.brainService.autoLearning$;
  }

  get perceptron() {
    return this.brainService.perceptrons[0][0];
  }

  get points() {
    return this.brainService.points;
  }

  get learnRate() {
    return this.brainService.learnRate;
  }

  get learnedDataPoints() {
    return this.brainService.learnedDataPoints;
  }

  ngOnInit(): void {
    this.brainService.createPerceptron(2);
    this.brainService.updateTrainingData();
  }

  addPoint({ x, y, click }: { x: number; y: number; click: 'left' | 'right' }) {
    const point = new Point(x / this.width, y / this.height, () =>
      click === 'left' ? 1 : 0
    );
    this.brainService.addPoint(point);
  }
}
