import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  inject,
  Injectable,
  PLATFORM_ID,
  Signal,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, NEVER, of, pairwise, switchMap } from 'rxjs';
import {
  lt,
  mul,
  Seconds,
  seconds,
  sToMs,
} from '../model/constants/time-utils';
import { CountdownModel } from '../model/training/countdown.model';
import { TrainingProgressService } from '../training-progress/training-progress.service';

const COUNTDOWN_BEEPS = 5;

@Injectable({
  providedIn: 'root',
})
export class IntervalCountdownService {
  private readonly currentInterval = inject(TrainingProgressService)
    .currentInterval;

  countdown: Signal<CountdownModel | null> = computed(() => {
    const currentInterval = this.currentInterval();
    if (
      currentInterval == null ||
      currentInterval.leftDuration > currentInterval.countdown
    ) {
      return null;
    }
    return {
      countdownTime: currentInterval.leftDuration,
      countdownTo: currentInterval.nextIntervalName,
    };
  });

  constructor() {
    let beepCounter = -1;

    const countdownPeeps$ = toObservable(this.currentInterval).pipe(
      filter((interval) => interval != null),
      filter((interval) => {
        return lt(interval.leftDuration, mul(sToMs(seconds(1)), beepCounter));
      })
    );

    toObservable(this.countdown)
      .pipe(
        pairwise(),
        switchMap((value) => {
          const [prev, current] = value;
          // start countdown
          if (prev == null && current != null) {
            beepCounter = COUNTDOWN_BEEPS;
          }
          // run countdown
          if (current != null) {
            return countdownPeeps$.pipe(
              map(() => [440, seconds(0.4)] as [number, Seconds])
            );
          }
          // end countdown with special beeps
          if (prev != null && current == null) {
            return of([660, seconds(0.8)] as [number, Seconds]);
          }
          return NEVER;
        })
      )
      .subscribe(([freq, duration]) => {
        beepCounter--;
        this.playBeep(freq, duration);
      });

    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      requestAudioPermission();
    }
  }

  private playBeep(frequency = 440, length: Seconds = seconds(0.2)): void {
    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator(); // Erzeugt den Ton
    const gainNode = audioCtx.createGain(); // Steuerung der Lautstärke

    oscillator.type = 'sine'; // Sinuswelle (weicher Ton)
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime); // Frequenz in Hz (Standard: 440 Hz)
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    gainNode.gain.setValueAtTime(1, audioCtx.currentTime); // Startlautstärke
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      audioCtx.currentTime + length
    ); // Lautstärke abklingen

    oscillator.start(); // Start des Tons
    oscillator.stop(audioCtx.currentTime + length); // Stop nach 0.2 Sekunden
  }
}
// Function to request audio permission
function requestAudioPermission() {
  const button = document.createElement('button');
  button.textContent = 'Enable Audio';
  button.style.position = 'absolute';
  button.style.left = '-9999px'; // Move the button off-screen
  document.body.appendChild(button);

  button.addEventListener('click', () => {
    try {
      const audioCtx = new AudioContext();
      audioCtx.resume().then(() => {
        console.log('Audio context resumed');
        button.remove(); // Remove button after enabling audio
      });
    } catch (error) {
      console.error('Error enabling audio:', error);
    }
  });

  // Programmatically click the button to request permission
  button.click();
}
