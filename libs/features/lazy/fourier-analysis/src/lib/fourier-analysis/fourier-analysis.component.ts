import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ElemResizedDirective, ResizedEvent } from '@wolsok/ui-kit';
import { Observable } from 'rxjs';
import { CircleAnalysisComponent } from '../circle-analysis/circle-analysis.component';
import { InputWaveComponent } from '../input-wave/input-wave.component';
import { WaveOptionsComponent } from '../input-wave/wave-options/wave-options.component';
import { FourierAnalysisQuery } from '../state/fourier-analysis.query';
import { FourierAnalysisService } from '../state/fourier-analysis.service';
import { FourierAnalysisState } from '../state/fourier-analysis.store';
import { InputWaveService } from '../state/input-wave.service';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    MatSidenavModule,
    ElemResizedDirective,
    MatCardModule,
    MatToolbarModule,
    MatButtonModule,
    WaveOptionsComponent,
    InputWaveComponent,
    CircleAnalysisComponent,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  selector: 'lazy-feat-fanal-fourier-analysis',
  templateUrl: './fourier-analysis.component.html',
  styleUrls: ['./fourier-analysis.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FourierAnalysisComponent {
  fourierAnalysis$: Observable<FourierAnalysisState>;
  isLoading$: Observable<boolean>;
  inputWaveCanvasWidth = 300;
  inputWaveCanvasHeight = 50;
  circleCanvasWidth = 300;
  circleCanvasHeight = 50;

  constructor(
    private el: ElementRef,
    private fourierAnalysisQuery: FourierAnalysisQuery,
    private _fourierAnalysisTestService: FourierAnalysisService,
    private _inputWaveService: InputWaveService
  ) {
    this.fourierAnalysis$ = this.fourierAnalysisQuery.select();
    this.isLoading$ = this.fourierAnalysisQuery.selectLoading();
  }

  onResize($event: ResizedEvent) {
    const availableWidth = Math.max(300, $event.newWidth - 32);

    this.inputWaveCanvasWidth = availableWidth;
    this.circleCanvasWidth = availableWidth;

    this.circleCanvasHeight = Math.max(250, this.circleCanvasWidth * (9 / 94));
    this.inputWaveCanvasHeight = Math.max(250, Math.round(this.inputWaveCanvasWidth * (9 / 64)));
  }
}
