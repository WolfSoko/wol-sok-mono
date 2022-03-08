import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CellWeights, weightsToArray } from '../cell-weights';

@Component({
  selector: 'app-weights-config',
  templateUrl: './weights-config.component.html',
  styleUrls: ['./weights-config.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeightsConfigComponent {
  @Output() weightsChanged: EventEmitter<CellWeights> =
    new EventEmitter<CellWeights>();
  sumOfWeights = -1;

  private weightsInternal?: CellWeights | null;

  get weights(): CellWeights | undefined | null {
    return this.weightsInternal;
  }

  @Input() set weights(weights: CellWeights | undefined | null) {
    this.weightsInternal = weights;
    this.updateSumOfWeights();
  }

  private updateSumOfWeights(): void {
    this.sumOfWeights = this.sumWeights();
  }

  weightChanged() {
    this.sumOfWeights = this.sumWeights();
    if (this.sumOfWeights === 0 && this.weights) {
      this.weightsChanged.emit(this.weights);
    }
  }

  private sumWeights(): number {
    if (this.weights) {
      const sum = weightsToArray(this.weights).reduce(
        (acc, next) => acc + next
      );
      return Math.floor(sum * 1000) / 1000;
    }
    return -1;
  }
}
