
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  Signal,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { InputWave } from '../model/input-wave.model';
import { InputWaveRepo } from '../state/input-wave-repo';
import { CircleCanvasComponent } from './circle-canvas/circle-canvas.component';

@Component({
  imports: [MatCardModule, CircleCanvasComponent],
  selector: 'lazy-feat-fanal-circle-analysis',
  templateUrl: './circle-analysis.component.html',
  styleUrls: ['./circle-analysis.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CircleAnalysisComponent {
  width = input.required<number>();
  height = input.required<number>();
  activeWave: Signal<InputWave | undefined> = inject(InputWaveRepo).activeWave;
}
