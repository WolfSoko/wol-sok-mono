import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DataDrawerComponent } from './data-drawer/data-drawer.component';
import { PolynomialRegressionService } from './polynomial-regression.service';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    DataDrawerComponent,
    MatButtonModule,
    MatTooltipModule,
  ],
  templateUrl: './polynomial-regression.component.html',
  styleUrls: ['./polynomial-regression.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolynomialRegressionComponent implements OnInit {
  randomCoefficients!: { a: number; b: number; c: number; d: number };
  learnedCoefficients!: { a: number; b: number; c: number; d: number };
  currentLoss?: number;
  isLearning = false;

  constructor(public polyService: PolynomialRegressionService) {}

  ngOnInit() {
    this.randomCoefficients = this.polyService.currentCoefficients;
  }

  async learn() {
    this.isLearning = true;
    await this.polyService.learnCoefficients(50, 10);
    this.learnedCoefficients = this.polyService.currentCoefficients;
    if (!this.polyService.predictionsAfter) {
      throw new Error('predictionsAfter needed');
    }
    const currentLossData = await this.polyService
      .loss(this.polyService.predictionsAfter, this.polyService.trainingData.ys)
      .data();
    this.currentLoss = currentLossData[0];
    this.isLearning = false;
  }

  setRandomCoefficients() {
    this.polyService.trueCoefficients = {
      a: Math.random() * 10 - 5,
      b: Math.random() * 10 - 5,
      c: Math.random() * 10 - 5,
      d: Math.random() * 10 - 5,
    };
  }
}
