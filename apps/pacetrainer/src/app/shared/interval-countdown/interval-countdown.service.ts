import { inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  distinctUntilChanged,
  filter,
  map,
  NEVER,
  Observable,
  of,
  switchMap,
} from 'rxjs';
import {
  div,
  Milliseconds,
  SECOND_IN_MS,
  Seconds,
  seconds,
} from '../model/constants/time-utils';
import { CountdownModel } from '../model/training/countdown.model';
import { TrainingName } from '../model/training/training-name';
import { TrainingNamePipe } from '../ui/training-name.pipe';

@Injectable({
  providedIn: 'root',
})
export class IntervalCountdownService {
  public readonly countdown = signal<CountdownModel | null>(null);
  private audioCtx: AudioContext | null = null;

  constructor() {
    const trainingNamePipe = inject(TrainingNamePipe);

    const countdownPeeps$ = toObservable(this.countdown).pipe(
      filter((countdown) => countdown != null),
      map(
        (countdown) =>
          [
            countdown,
            Math.floor(div(countdown.timeLeft, SECOND_IN_MS)),
            Math.round(div(countdown.countdownTime, SECOND_IN_MS)),
          ] as [CountdownModel, number, number]
      ),
      distinctUntilChanged(
        ([cPrev, pPrev, maxBeepsPrev], [cNext, pNext, maxBeepsNext]) =>
          cNext.countdownTo === cPrev.countdownTo &&
          pPrev === pNext &&
          maxBeepsPrev === maxBeepsNext
      ),
      switchMap(([countdown, secondsLeft, maxBeeps]) => {
        const isEnd = countdown.countdownTo === 'finished';
        const trainingName = trainingNamePipe.transform(countdown.countdownTo);
        if (secondsLeft === maxBeeps) {
          const announcement = isEnd
            ? `Noch ${secondsLeft} Sekunden!`
            : `${trainingName} in ${secondsLeft} Sekunden!`;
          return of([440, seconds(0.4), announcement]) as Observable<
            [number, Seconds, string | undefined]
          >;
        }
        if (secondsLeft === 0) {
          const announcement = isEnd
            ? 'Training beendet. Gut gemacht!'
            : `Jetzt ${trainingName}!`;
          return of([660, seconds(0.8), announcement]) as Observable<
            [number, Seconds, string | undefined]
          >;
        }
        if (secondsLeft < maxBeeps && secondsLeft > 0) {
          return of([880, seconds(0.4), undefined]) as Observable<
            [number, Seconds, string | undefined]
          >;
        }
        return NEVER;
      })
    );

    countdownPeeps$.subscribe(([freq, beepDuration, textToSpeak]) => {
      if (textToSpeak) {
        this.textToSpeech(textToSpeak);
      }
      this.playBeep(freq, beepDuration);
    });
  }

  /**
   * Browsers (iOS Safari in particular) only allow audio output once it has
   * been started from a user gesture. Call this from a click handler.
   */
  public unlockAudio(): void {
    const audioCtx = this.getAudioContext();
    if (audioCtx?.state === 'suspended') {
      void audioCtx.resume();
    }
  }

  public updateCountdown(
    countdownTime: Milliseconds,
    timeLeft: Milliseconds,
    countdownTo: TrainingName
  ): void {
    this.countdown.set({
      countdownTime,
      timeLeft,
      countdownTo,
    });
  }

  public endCountdown(): void {
    this.countdown.set(null);
  }
  private playBeep(frequency = 440, length: Seconds = seconds(0.2)): void {
    const audioCtx = this.getAudioContext();
    if (!audioCtx) {
      return;
    }

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      audioCtx.currentTime + length
    );

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + length);
  }

  private getAudioContext(): AudioContext | null {
    if (this.audioCtx) {
      return this.audioCtx;
    }
    if (!('AudioContext' in globalThis)) {
      console.warn('AudioContext not supported in this browser');
      return null;
    }
    this.audioCtx = new AudioContext();
    return this.audioCtx;
  }

  private textToSpeech(text: string): void {
    if (!('speechSynthesis' in globalThis)) {
      console.warn('Speech synthesis not supported in this browser.');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = 'de-DE';
    utterance.pitch = 1;
    utterance.rate = 1.25;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }
}
