import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
  Signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ElevateCardDirective, ShowFpsComponent } from '@wolsok/ui-kit';
import { RandomService } from '@wolsok/utils-math';
import { MeasureFps } from '@wolsok/utils-measure-fps';
import { PoissonCalcService } from '../../domain/poisson-calc.service';
import { Vector } from '../../domain/model/vector';
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
    MatButton,
    ShowFpsComponent,
  ],
  selector: 'lazy-feat-poisson-page',
  templateUrl: './poisson.component.html',
  styleUrls: ['./poisson.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    PoissonCalcService,
    RandomService,
    { provide: MeasureFps, useValue: new MeasureFps() },
  ],
})
export class PoissonComponent implements OnInit {
  canvasWidth = 600;
  canvasHeight = 600;

  play = signal(false);
  showDebug = signal(false);
  fps: Signal<number | undefined>;

  constructor(
    public poissonCalc: PoissonCalcService,
    private readonly measureFps: MeasureFps
  ) {
    this.fps = toSignal(this.measureFps.fps$);
  }

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
    if (this.play()) {
      this.poissonCalc.calculate();
      this.measureFps.signalFrameReady();
    }
  }

  step(): void {
    this.poissonCalc.calculate();
  }

  addPoint(vector: Vector) {
    this.poissonCalc.addPointForCalculation(vector);
  }

  setPlay(play: boolean) {
    this.play.set(play);
  }

  toggleDebugInfo(): void {
    this.showDebug.update((showDebug: boolean) => !showDebug);
  }
}
