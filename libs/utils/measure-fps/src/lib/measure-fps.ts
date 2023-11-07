import { bufferTime, filter, map, Observable, shareReplay, Subject } from 'rxjs';
import { deltaOp, filterLessEqualOp, roundOp } from '@wolsok/utils-operators';

const toFps = map<number, number>((ms) => 1000.0 / ms);

export class MeasureFps {
  private timeStampsAction$ = new Subject<number>();

  fps$: Observable<number>;
  frameTimeMs$: Observable<number>;

  constructor(
    private readonly avgWindowSize = 300,
    private readonly decimals = 1
  ) {
    const frameTimeMs: Observable<number> = this.timeStampsAction$.asObservable().pipe(
      filterLessEqualOp,
      deltaOp,
      bufferTime(this.avgWindowSize),
      filter((measures) => measures.length > 0),
      map((measures) => measures.reduce((last, measure) => last + measure, 0) / measures.length)
    );

    this.fps$ = frameTimeMs.pipe(toFps, roundOp(this.decimals), shareReplay(1));
    this.frameTimeMs$ = frameTimeMs.pipe(roundOp(0), shareReplay(1));
  }

  signalFrameReady() {
    const timestamp = performance.now();
    this.timeStampsAction$.next(Math.floor(timestamp));
  }
}
