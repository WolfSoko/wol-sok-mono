import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { BehaviorSubject, filter, Observable, Subject } from 'rxjs';
import { CellWeights, weightsToArray } from '../cell-weights-to-array';

type SumOfWeights = {
  sum: number;
  valid: boolean;
};

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
  ],
  selector: 'feat-lazy-react-diff-weights-config',
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

  private static sumWeightsTo3Digits(weights: CellWeights): number {
    const sum = weightsToArray(weights).reduce((acc, next) => acc + next);
    return Math.round(sum * 1000.0) / 1000.0;
  }

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
      const sumWith3Digits =
        WeightsConfigComponent.sumWeightsTo3Digits(weights);
      return { sum: sumWith3Digits, valid: sumWith3Digits === 0.0 };
    }
    return { sum: -1, valid: false };
  }
}
