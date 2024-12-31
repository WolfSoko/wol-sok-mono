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
  readonly countdown = signal<CountdownModel | null>(null);

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
        const trainingName = trainingNamePipe.transform(countdown.countdownTo);
        if (secondsLeft === maxBeeps) {
          return of([
            440,
            seconds(0.4),
            trainingName
              ? `${trainingName} in ${secondsLeft} Sekunden!`
              : undefined,
          ]) as Observable<[number, Seconds, string | undefined]>;
        }
        if (secondsLeft === 0) {
          return of([
            660,
            seconds(0.8),
            trainingName ? `Jetzt ${trainingName}!` : undefined,
          ]) as Observable<[number, Seconds, string | undefined]>;
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

  updateCountdown(
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

  endCountdown(): void {
    this.countdown.set(null);
  }
  private playBeep(frequency = 440, length: Seconds = seconds(0.2)): void {
    if (!('AudioContext' in globalThis)) {
      console.warn('AudioContext not supported in this browser');
      return;
    }
    const audioCtx = new AudioContext();

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

  private textToSpeech(text: string) {
    if (!('speechSynthesis' in globalThis)) {
      console.warn('Speech synthesis not supported in this browser.');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text); // Create a new utterance for the specified text

    utterance.lang = 'de-DE';
    utterance.pitch = 1;
    utterance.rate = 1.25;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }
}
