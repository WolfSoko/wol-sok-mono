import { Observable, OperatorFunction } from 'rxjs';

export interface WorkerPostParams<T> {
  data: T;
  transferList?: Transferable[];
}

// inline web worker helper
function createWorker<T, R>(fn: (input: T) => WorkerPostParams<R>) {
  /* tslint:disable:no-trailing-whitespace*/
  const webWorkerTemplate = `
    self.cb = ${fn.toString()};
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

export function mapWorkerOp<T, R>(
  workerFunction: (value: T) => WorkerPostParams<R>
): OperatorFunction<T | WorkerPostParams<T>, R> {
  return (source: Observable<T | WorkerPostParams<T>>) =>
    new Observable<R>((subscriber) => {
      const worker: Worker = createWorker(workerFunction);
      worker.onmessage = (event: MessageEvent) =>
        subscriber.next(event.data as R);
      worker.onerror = (error) => subscriber.error(error);

      // Errors and completions of the source are passed straight through; only
      // the values take the detour through the worker.
      const subscription = source.subscribe({
        next: (value) => postMessage(value),
        error: (error: unknown) => subscriber.error(error),
        complete: () => subscriber.complete(),
      });

      function postMessage(value: T | WorkerPostParams<T>): void {
        if (!hasTransferList(value)) {
          worker.postMessage(value);
          return;
        }
        worker.postMessage(value.data, value.transferList);
      }

      function hasTransferList(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value: any
      ): value is WorkerPostParams<T> & { transferList: Transferable[] } {
        return (
          !!value.transferList &&
          value.transferList instanceof Array &&
          value.transferList.length > 0
        );
      }

      return () => {
        subscription.unsubscribe();
        worker.terminate();
      };
    });
}
