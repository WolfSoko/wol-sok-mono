import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Observable } from 'rxjs';
import { InputWave } from '../state/input-wave.model';
import { InputWaveQuery } from '../state/input-wave.query';
import { InputWaveService } from '../state/input-wave.service';
import { WaveCanvasComponent } from './wave-canvas/wave-canvas.component';

@Component({
  standalone: true,
  selector: 'lazy-feat-fanal-input-wave',
  templateUrl: './input-wave.component.html',
  styleUrls: ['./input-wave.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatIconModule, MatButtonModule, WaveCanvasComponent, CommonModule],
})
export class InputWaveComponent {
  @Input() width = 0;
  @Input() height = 0;
  activeWave$: Observable<InputWave | undefined>;

  constructor(private waveQuery: InputWaveQuery, private inputWaveService: InputWaveService) {
    this.activeWave$ = waveQuery.selectActive();
  }

  listenToWaveAudio() {
    this.inputWaveService.listenToWave();
  }
}
