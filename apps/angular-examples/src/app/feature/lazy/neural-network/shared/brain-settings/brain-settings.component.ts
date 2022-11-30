import {ChangeDetectionStrategy, Component, Input} from "@angular/core";
import {BrainService} from "../brain.service";
import {Observable} from "rxjs";

@Component({
  selector: 'app-brain-settings',
  templateUrl: './brain-settings.component.html',
  styleUrls: ['./brain-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
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
