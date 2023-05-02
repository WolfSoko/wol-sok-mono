import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ElevateCardDirective } from '@wolsok/ui-kit';
import { Observable } from 'rxjs';
import { BrainService } from '../brain.service';

@Component({
  selector: 'app-brain-settings',
  templateUrl: './brain-settings.component.html',
  styleUrls: ['./brain-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatCardModule,
    ElevateCardDirective,
    MatButtonModule,
    MatSlideToggleModule,
    MatTooltipModule,
    FormsModule,
    AsyncPipe,
  ],
})
export class BrainSettingsComponent {
  @Input() perceptronLayers?: number[];

  autoLearning$: Observable<boolean>;

  constructor(private brainService: BrainService) {
    this.autoLearning$ = brainService.autoLearning$;
  }

  train() {
    this.brainService.train();
  }

  testAgainstNewData() {
    this.brainService.updateTrainingData();
  }

  toggleAutoLearning($event: boolean) {
    this.brainService.toggleAutoTraining($event);
  }

  resetPerceptron() {
    if (this.perceptronLayers) {
      this.brainService.createMultiPerceptron(2, this.perceptronLayers);
    } else {
      this.brainService.createPerceptron();
    }
  }

  clearPoints() {
    this.brainService.clearPoints();
  }
}
