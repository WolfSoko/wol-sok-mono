import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  Signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { InputWave } from '../model/input-wave.model';
import { InputWaveRepo } from '../state/input-wave-repo';
import { InputWaveService } from '../state/input-wave.service';
import { WaveCanvasComponent } from './wave-canvas/wave-canvas.component';

@Component({
  selector: 'lazy-feat-fanal-input-wave',
  templateUrl: './input-wave.component.html',
  styleUrls: ['./input-wave.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatIconModule, MatButtonModule, WaveCanvasComponent],
})
export class InputWaveComponent {
  private waveRepo: InputWaveRepo = inject(InputWaveRepo);
  private inputWaveService: InputWaveService = inject(InputWaveService);
  private snackbar: MatSnackBar = inject(MatSnackBar);

  width = input.required<number>();
  height = input.required<number>();
  activeWave: Signal<InputWave | undefined> = this.waveRepo.activeWave;
  audioRecorderState = this.waveRepo.audioRecorderState;

  constructor() {
    effect(() => {
      const recState = this.waveRepo.audioRecorderState();
      if (recState?.state === 'error') {
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

  private informAboutRecordingError(error: unknown): void {
    let message = 'Error recording audio.';
    if (error instanceof Error && error.message.includes('Permission denied')) {
      message += ' Permission given?';
    }

    this.snackbar.open(message, undefined, {
      duration: 6000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }
}
