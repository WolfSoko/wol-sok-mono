import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSliderModule } from '@angular/material/slider';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ElemResizedDirective } from '@wolsok/ui-kit';
import { CircleAnalysisComponent } from './circle-analysis/circle-analysis.component';
import { CircleCanvasComponent } from './circle-analysis/circle-canvas/circle-canvas.component';
import { FourierAnalysisRoutingModule } from './fourier-analysis-routing.module';
import { FourierAnalysisComponent } from './fourier-analysis/fourier-analysis.component';
import { InputWaveComponent } from './input-wave/input-wave.component';
import { WaveCanvasComponent } from './input-wave/wave-canvas/wave-canvas.component';
import { WaveOptionsComponent } from './input-wave/wave-options/wave-options.component';

@NgModule({
  imports: [
    FourierAnalysisRoutingModule,
    ReactiveFormsModule,
    CommonModule,
    ElemResizedDirective,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSidenavModule,
    MatSliderModule,
    MatToolbarModule,
  ],
  declarations: [
    FourierAnalysisComponent,
    InputWaveComponent,
    WaveCanvasComponent,
    WaveOptionsComponent,
    CircleAnalysisComponent,
    CircleCanvasComponent,
  ],
})
export class FourierAnalysisModule {}
