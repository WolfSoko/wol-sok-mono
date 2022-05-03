import { map, Observable, Subject, tap } from 'rxjs';
import {
  deltaOp,
  filterLessEqualOp,
  movingAverage,
  roundOp,
} from 'wolsok/utils-operators';

const toFps = map<number, number>((ms) => 1000.0 / ms);

export class MeasureFps {
  private timeStampsAction$ = new Subject<number>();
  private fps = 0;

  fps$: Observable<number> = this.timeStampsAction$.asObservable().pipe(
    filterLessEqualOp,
    deltaOp,
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
