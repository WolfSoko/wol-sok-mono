import { bufferTime, filter, map, Observable, Subject } from 'rxjs';
import { deltaOp, filterLessEqualOp, roundOp } from 'wolsok/utils-operators';

const toFps = map<number, number>((ms) => 1000.0 / ms);

export class MeasureFps {
  constructor(
    private readonly avgWindowSize = 300,
    private readonly decimals = 1
  ) {}

  private timeStampsAction$ = new Subject<number>();

  fps$: Observable<number> = this.timeStampsAction$.asObservable().pipe(
    filterLessEqualOp,
    deltaOp,
    bufferTime(this.avgWindowSize),
    filter((measures) => measures.length > 0),
    map(
      (measures) =>
        measures.reduce((last, measure) => last + measure, 0) / measures.length
    ),
    toFps,
    roundOp(this.decimals)
  );

  signalFrameReady() {
    const timestamp = performance.now();
    this.timeStampsAction$.next(Math.floor(timestamp));
  }
}
