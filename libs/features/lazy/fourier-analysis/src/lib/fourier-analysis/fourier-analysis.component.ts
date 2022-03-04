import {ChangeDetectionStrategy, Component, ElementRef} from '@angular/core';
import {ResizedEvent} from '@wolsok/ui-kit-elem-resized';
import {Observable} from 'rxjs';
import {FourierAnalysisQuery} from '../state/fourier-analysis.query';
import {FourierAnalysisService} from '../state/fourier-analysis.service';
import {FourierAnalysisState} from '../state/fourier-analysis.store';
import {InputWaveService} from '../state/input-wave.service';

@Component({
  selector: 'lazy-feat-fanal-fourier-analysis',
  templateUrl: './fourier-analysis.component.html',
  styleUrls: ['./fourier-analysis.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FourierAnalysisComponent {
  fourierAnalysis$: Observable<FourierAnalysisState>;
  isLoading$: Observable<boolean>;
  inputWaveCanvasWidth = 0;
  inputWaveCanvasHeight = 0;
  circleCanvasWidth = 0;
  circleCanvasHeight = 0;

  constructor(
    private el: ElementRef,
    private fourierAnalysisQuery: FourierAnalysisQuery,
    private fourierAnalysisTestService: FourierAnalysisService,
    private inputWaveService: InputWaveService
  ) {
    this.fourierAnalysis$ = this.fourierAnalysisQuery.select();
    this.isLoading$ = this.fourierAnalysisQuery.selectLoading();
  }

  onResize($event: ResizedEvent) {
    const availableWidth = Math.max(300, $event.newWidth - 32);

    this.inputWaveCanvasWidth = availableWidth;
    this.circleCanvasWidth = availableWidth;

    this.circleCanvasHeight = Math.max(250, this.circleCanvasWidth * (9 / 94));
    this.inputWaveCanvasHeight = Math.max(
      250,
      Math.round(this.inputWaveCanvasWidth * (9 / 64))
    );
  }
}
