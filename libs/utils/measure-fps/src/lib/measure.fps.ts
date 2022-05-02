import {
  distinctUntilChanged,
  map,
  Observable,
  OperatorFunction,
  pairwise,
  pipe,
  Subject,
  tap,
} from 'rxjs';

const toFps = map<number, number>((ms) => 1000.0 / ms);

const filterLessEqual = distinctUntilChanged<number>(
  (lastT, nextT) => lastT >= nextT
);

const delta = pipe(
  pairwise<number>(),
  map(([lastT, nextT]) => nextT - lastT)
);

function movingAverage(
  windowSize: number
): (values: [pre: number, next: number]) => number {
  const nextWeight = 1.0 / windowSize;
  const prevWeight = 1.0 - nextWeight;
  return ([pre, next]: [number, number]) =>
    prevWeight * pre + nextWeight * next;
}

function round(decimals: number): (n: number) => number {
  return (n: number) => {
    const factor = Math.pow(10, decimals);
    return Math.round(n * factor) / factor;
  };
}

function roundOp(decimals = 2): OperatorFunction<number, number> {
  return map(round(decimals));
}

export class MeasureFps {
  private timeStampsAction$ = new Subject<number>();
  private fps = 0;

  fps$: Observable<number> = this.timeStampsAction$.asObservable().pipe(
    filterLessEqual,
    delta,
    toFps,
    map((nextFps) => movingAverage(100)([this.fps, nextFps])),
    roundOp(1),
    tap((nextFps) => (this.fps = nextFps))
  );

  signalFrameReady() {
    const timestamp = performance.now();
    this.timeStampsAction$.next(timestamp);
  }
}
