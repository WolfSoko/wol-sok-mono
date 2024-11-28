import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
  OnInit,
  output,
  runInInjectionContext,
  Signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { animationFrameScheduler, interval } from 'rxjs';
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
        <span>{{ timeLeft?.() | date: 'H:mm:ss' }}</span>
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
            // stroke-width: 2px;
            // stroke: #88b462;

            stroke-width: 1px;
            stroke: grey;
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
            transition: 1s linear all;
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

  timeRun = input(0); // milliseconds
  paused = input(false);

  onComplete = output<boolean>();

  private timer?: Signal<number>;
  timeLeft?: Signal<number>;

  ngOnInit() {
    runInInjectionContext(this.injector, () => {
      const intervalTime = 1000;
      this.timer = toSignal(
        interval(intervalTime, animationFrameScheduler).pipe(
          map((i) => i * intervalTime),
          takeUntilDestroyed()
        ),
        { initialValue: 0 }
      );

      this.timeLeft = computed(
        () => this.duration() - this.timeRun() - this.timer!(),
        {
          equal: (a, b) => a === b || this.paused(),
        }
      );
      effect(() => {
        if (this.timeLeft!() <= 0) {
          this.onComplete.emit(true);
        }
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
