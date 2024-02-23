import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  Input,
  Signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatLabel } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { InputWaveUIModel } from '../state/input-wave-ui.model';
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
  imports: [
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    WaveCanvasComponent,
    CommonModule,
    MatLabel,
  ],
})
export class InputWaveComponent {
  @Input() width = 0;
  @Input() height = 0;
  activeWave: Signal<InputWave | undefined>;
  audioRecorderState: Signal<InputWaveUIModel>;

  constructor(
    private waveQuery: InputWaveQuery,
    private inputWaveService: InputWaveService,
    private snackbar: MatSnackBar
  ) {
    this.activeWave = toSignal(waveQuery.selectActive());
    this.audioRecorderState = toSignal(waveQuery.selectUI(), {
      initialValue: { audioRecorderState: 'ready' },
    });

    effect(() => {
      const recState = this.audioRecorderState();
      if (recState.audioRecorderState === 'error') {
        const error = recState.error;
        console.error('Error recording Audio', error);
        this.informAboutRecordingError(error);
      }
    });
  }

  listenToWaveAudio() {
    this.inputWaveService.listenToWave();
  }

  async recordSound(): Promise<void> {
    this.inputWaveService.recordAudio();
  }

  stopRecording(): void {
    this.inputWaveService.stopRecording();
  }

  private informAboutRecordingError(error: any): void {
    let message = 'Error recording audio.';
    if (error instanceof Error && error.message.includes('Permission denied')) {
      message += ' Permission given?';
    }

    const snack = this.snackbar.open(message, undefined, {
      duration: 6000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }
}
