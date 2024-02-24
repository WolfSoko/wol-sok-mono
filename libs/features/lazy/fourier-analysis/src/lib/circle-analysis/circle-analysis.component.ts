import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  Signal,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { InputWave } from '../model/input-wave.model';
import { InputWaveRepo } from '../state/input-wave-repo';
import { CircleCanvasComponent } from './circle-canvas/circle-canvas.component';

@Component({
  standalone: true,
  imports: [CommonModule, MatCardModule, CircleCanvasComponent],
  selector: 'lazy-feat-fanal-circle-analysis',
  templateUrl: './circle-analysis.component.html',
  styleUrls: ['./circle-analysis.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CircleAnalysisComponent {
  @Input() width!: number;
  @Input() height!: number;
  activeWave: Signal<InputWave | undefined>;

  constructor(private waveQuery: InputWaveRepo) {
    this.activeWave = waveQuery.activeWave;
  }
}
