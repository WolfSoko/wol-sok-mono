import { Observable, Subscriber } from 'rxjs';

export class WorkerPostParams<T> {
  data?: T;
  transferList?: Transferable[];
}

type WorkerParams<T> = WorkerPostParams<T> | T;

class MapWorkerSubscriber<
  T extends WorkerPostParams<T>,
  R
> extends Subscriber<T> {
  constructor(destination: Subscriber<R>, private worker: Worker) {
    super(destination);

    this.worker.onmessage = (event: MessageEvent) =>
      this.destination.next?.(event.data as R);
    this.worker.onerror = (error) => this.destination.error?.(error);
  }

  protected override _next(value: T): void {
    if (value.transferList || value.transferList) {
      this.worker.postMessage(value.data, value.transferList);
    } else {
      this.worker.postMessage(value);
    }
  }

  protected override _complete(): void {
    this.worker.terminate();
    super._complete();
  }

  public override unsubscribe(): void {
    super.unsubscribe();
    this.worker.terminate();
  }
}

// inline web worker helper
function createWorker<T, R>(fn: (input: T) => WorkerParams<R>) {
  /* tslint:disable:no-trailing-whitespace*/
  const webWorkerTemplate = `
    self.cb = ${fn};
    self.onmessage = function (e) {
      const result =  self.cb(e.data);
      if(result.transferList || result.data){
        self.postMessage(result.data, result.transferList);
      } else {
        self.postMessage(result);
      }
    };
  `;
  /* tslint:enable:no-trailing-whitespace*/

  const blob = new Blob([webWorkerTemplate], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  return new Worker(url);
}

export const mapWorkerOp =
  <T, R>(workerFunction: (input: T) => WorkerParams<R>) =>
  (source: Observable<WorkerParams<T>>) =>
    new Observable<R>((subscriber) => {
      if (!(workerFunction instanceof Function)) {
        throw new TypeError('argument is not a function!');
      }
      const worker: Worker = createWorker(workerFunction);
      source.subscribe(new MapWorkerSubscriber(subscriber, worker));
    });
