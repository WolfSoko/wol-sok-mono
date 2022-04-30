import {
  ChangeDetectionStrategy,
  Component,
  Input,
  Output,
} from '@angular/core';
import { BehaviorSubject, filter, Observable, Subject } from 'rxjs';
import { CellWeights, weightsToArray } from '../cell-weights-to-array';

type SumOfWeights = {
  sum: number;
  valid: boolean;
};

@Component({
  selector: 'lazy-feat-react-diff-weights-config',
  templateUrl: './weights-config.component.html',
  styleUrls: ['./weights-config.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeightsConfigComponent {
  sumOfWeightsAndValidity$ = new BehaviorSubject<SumOfWeights>({
    sum: -1,
    valid: false,
  });
  private weightsInternal!: CellWeights;

  get weights(): CellWeights {
    return this.weightsInternal;
  }

  @Input() set weights(weights: CellWeights) {
    this.weightsInternal = weights;
    this.updateSumOfWeights();
  }

  private weightsChangedSubject = new Subject<CellWeights>();

  @Output() weightsChanged: Observable<CellWeights> =
    this.weightsChangedSubject.pipe(
      filter((weights) => this.sumWeightsAndCheckValidity(weights).valid)
    );

  weightChanged() {
    this.updateSumOfWeights();
    this.weightsChangedSubject.next(this.weights);
  }

  private updateSumOfWeights(): void {
    this.sumOfWeightsAndValidity$.next(this.sumWeightsAndCheckValidity());
  }

  private sumWeightsAndCheckValidity(
    weights: CellWeights = this.weights
  ): SumOfWeights {
    if (weights) {
      const sumWith3Digits = this.sumWeightsTo3Digits(weights);
      return { sum: sumWith3Digits, valid: sumWith3Digits === 0.0 };
    }
    return { sum: -1, valid: false };
  }

  private sumWeightsTo3Digits(weights: CellWeights): number {
    const sum = weightsToArray(weights).reduce((acc, next) => acc + next);
    return Math.round(sum * 1000.0) / 1000.0;
  }
}
