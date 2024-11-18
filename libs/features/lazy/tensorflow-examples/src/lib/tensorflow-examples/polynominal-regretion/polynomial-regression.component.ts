import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  WritableSignal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HeadlineAnimationService } from '@wolsok/headline-animation';
import { ElevateCardDirective } from '@wolsok/ui-kit';
import { DataDrawerComponent } from './data-drawer/data-drawer.component';
import {
  Coefficients,
  PolynomialRegressionService,
} from './polynomial-regression.service';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    DataDrawerComponent,
    MatButtonModule,
    MatTooltipModule,
    ElevateCardDirective,
  ],
  templateUrl: './polynomial-regression.component.html',
  styleUrls: ['./polynomial-regression.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolynomialRegressionComponent {
  private readonly headlineAnimationService = inject(HeadlineAnimationService);

  public polyService = inject(PolynomialRegressionService);

  trueCoefficients = this.polyService.trueCoefficients;
  beforeRandomDataChangedCoefficients = signal<Coefficients | null>(null);
  randomCoefficients = () => this.polyService.getCurrentCoefficients();
  learnedCoefficients = signal<Coefficients | null>(null);
  currentLoss: WritableSignal<number> = signal(0);
  isLearning = signal(false);

  async learn() {
    this.isLearning.set(true);
    this.headlineAnimationService.stopAnimation();

    await this.polyService.learnCoefficients(50, 10);

    this.learnedCoefficients.set(this.polyService.getCurrentCoefficients());
    const predictionsAfter = this.polyService.predictionsAfter();
    if (!predictionsAfter) {
      throw new Error('predictionsAfter needed');
    }

    const currentLossData = await this.polyService
      .loss(predictionsAfter, this.polyService.trainingData()!.ys)
      .data();

    this.currentLoss.set(currentLossData[0]);
    this.isLearning.set(false);
    this.headlineAnimationService.startAnimation();
  }

  setRandomCoefficients() {
    this.beforeRandomDataChangedCoefficients.set(this.learnedCoefficients());
    this.polyService.setTrueCoefficients({
      a: Math.random() * 10 - 5,
      b: Math.random() * 10 - 5,
      c: Math.random() * 10 - 5,
      d: Math.random() * 10 - 5,
    });
  }
}
