/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  EventEmitter,
  inject,
  Injector,
  input,
  OnInit,
  Output,
  runInInjectionContext,
  Signal,
} from '@angular/core';
import {
  takeUntilDestroyed,
  toObservable,
  toSignal,
} from '@angular/core/rxjs-interop';
import {
  animationFrameScheduler,
  interval,
  NEVER,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';
import { map } from 'rxjs/operators';

const FULL_DASHARRAY = 283;

@Component({
  selector: 'pacetrainer-countdown-circle',
  template: `
    <div class="base-timer" data-qa="countdown-timer">
      <svg
        class="base-timer-svg"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g class="base-timer-circle">
          <circle
            [class.base-timer-completed]="this.timeLeft?.() ?? 1 <= 0"
            [class.base-timer-stroke]="this.timeLeft?.() ?? 1 > 0"
            cx="50"
            cy="50"
            r="45"
          />
          <path
            [attr.stroke-dasharray]="dasharray()"
            [style.stroke]="'blue'"
            id="remaining-time-stroke"
            d=" M 50, 50
                m -45, 0
                a 45,45 0 1,0 90,0
                a 45,45 0 1,0 -90,0"
          ></path>
        </g>
      </svg>
      <span class="time">
        {{ timeLeft?.() | date: timeLeftFormat!() : 'UTC' }}
      </span>
    </div>
  `,
  standalone: true,
  styles: [
    `
      :host {
        .base-timer {
          position: relative;
          height: 200px;
          width: 200px;

          &-circle {
            fill: none;
            stroke: none;
          }

          &-stroke {
            stroke-width: 1px;
            stroke: grey;
          }

          &-completed {
            stroke: #88b462;
            stroke-width: 1px;
          }

          .time {
            position: absolute;
            width: 200px;
            height: 200px;
            top: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 26px;

            img {
              height: 80px;
            }
          }

          #remaining-time-stroke {
            stroke-width: 2px;
            transform: rotate(90deg);
            transform-origin: center;
            transition: 300ms ease-in all;
            stroke: #1cbbf8;
          }

          .base-timer-svg {
            transform: scaleX(-1);
          }
        }
      }
    `,
  ],
  imports: [DatePipe],
})
export class CountDownCircleComponent implements OnInit {
  private readonly injector = inject(Injector);

  duration = input.required<number>(); // milliseconds

  paused = input(false);

  @Output() onComplete = new EventEmitter<void>();

  private timer?: Signal<number>;
  timeLeft?: Signal<number>;
  timeLeftFormat?: Signal<string>;

  ngOnInit() {
    runInInjectionContext(this.injector, () => {
      const intervalPeriod = 1000;
      let timerState = 0;
      this.timer = toSignal(
        toObservable(this.paused).pipe(
          switchMap((paused) =>
            paused ? NEVER : interval(intervalPeriod, animationFrameScheduler)
          ),
          tap(() => (timerState += intervalPeriod)),
          map(() => timerState),
          takeUntilDestroyed(),
          takeUntil(this.onComplete)
        ),
        { initialValue: 0 }
      );

      this.timeLeft = computed(
        () => Math.max(this.duration() - this.timer!(), 0),
        {
          equal: (a, b) => a === b || this.paused(),
        }
      );
      /**
       * formats the timeLeft (milliseconds) in the format HH'h':mm'm':ss's'
       * shows only what is necessary
       */
      this.timeLeftFormat = computed(() => {
        const timeLeft = this.timeLeft?.() ?? 0;
        if (timeLeft >= 3600000) {
          return 'H:mm:ss';
        }
        if (timeLeft > 60000) {
          return 'm:ss';
        }
        return 's';
      });

      effect(() => {
        if (this.timeLeft!() <= 0) {
          this.onComplete.emit();
        }
      });
      effect(() => {
        // call to make sure the timer is reseted when the duration changes
        // TODO: replace with linked signal when available
        this.duration();
        timerState = 0;
      });
    });
  }

  dasharray = computed(() => {
    const timeLeft: number = this.timeLeft?.() ?? this.duration();
    const rawFraction = timeLeft / this.duration();
    const fraction = rawFraction - (1 / this.duration()) * (1 - rawFraction);
    const remaining = Math.round(fraction * FULL_DASHARRAY);
    return `${remaining} ${FULL_DASHARRAY}`;
  });
}
