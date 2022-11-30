import { CommonModule } from '@angular/common';
import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ElevateCardDirective } from '@wolsok/ui-kit';
import {PoissonCalcService} from '../../domain/poisson-calc.service';
import {Vector} from '../../domain/model/vector';
import { SimControlsComponent } from '../sim-controls/sim-controls.component';
import { CanvasViewComponent } from '../canvas-view/canvas-view.component';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    CanvasViewComponent,
    MatToolbarModule,
    ElevateCardDirective,
    SimControlsComponent,
  ],
  selector: 'app-poisson',
  templateUrl: './poisson.component.html',
  styleUrls: ['./poisson.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PoissonCalcService]
})
export class PoissonComponent implements OnInit {
  canvasWidth = 600;
  canvasHeight = 600;

  play = false;

  constructor(public poissonCalc: PoissonCalcService) {}

  ngOnInit(): void {
    this.setup();
  }

  setup() {
    this.poissonCalc.setup(this.canvasWidth, this.canvasHeight);
  }

  reset(): void {
    this.setup();
  }

  calculate(): void {
    if (this.play) {
      this.poissonCalc.calculate();
    }
  }

  addPoint(vector: Vector) {
    this.poissonCalc.addPointForCalculation(vector);
  }

  setPlay(play: boolean) {
    this.play = play;
  }
}
