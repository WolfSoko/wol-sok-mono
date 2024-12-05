import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ElemResizedDirective, ResizedEvent } from '@wolsok/ui-kit';
import { CircleAnalysisComponent } from '../circle-analysis/circle-analysis.component';
import { InputWaveComponent } from '../input-wave/input-wave.component';
import { WaveOptionsComponent } from '../input-wave/wave-options/wave-options.component';

@Component({
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
  inputWaveCanvasWidth = signal(300);
  circleCanvasWidth = signal(300);

  inputWaveCanvasHeight = computed(() =>
    Math.max(250, Math.round(this.inputWaveCanvasWidth() * (9 / 64)))
  );

  circleCanvasHeight = computed(() =>
    Math.max(250, this.circleCanvasWidth() * (9 / 94))
  );

  onResize($event: ResizedEvent) {
    const availableWidth = Math.max(300, $event.newWidth - 32);
    this.inputWaveCanvasWidth.set(availableWidth);
    this.circleCanvasWidth.set(availableWidth);
  }
}
