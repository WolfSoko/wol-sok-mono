import { Observable, OperatorFunction, Subscriber } from 'rxjs';
import { createOperatorSubscriber } from 'rxjs/internal/operators/OperatorSubscriber';
import { operate } from 'rxjs/internal/util/lift';

export interface WorkerPostParams<T> {
  data: T;
  transferList?: Transferable[];
}

// inline web worker helper
function createWorker<T, R>(fn: (input: T) => WorkerPostParams<R>) {
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

export function mapWorkerOp<T, R>(
  workerFunction: (value: T) => WorkerPostParams<R>
): OperatorFunction<T | WorkerPostParams<T>, R> {
  return operate((source: Observable<T | WorkerPostParams<T>>, subscriber: Subscriber<R>) => {
    const worker: Worker = createWorker(workerFunction);
    const listensForWorkerMessages = false;

    // Subscribe to the source, all errors and completions are sent along
    // to the consumer.
    source.subscribe(
      createOperatorSubscriber(
        subscriber,
        (value: T | WorkerPostParams<T>) => {
          if (!listensForWorkerMessages) {
            worker.onmessage = (event: MessageEvent) => subscriber.next(event.data as R);
            worker.onerror = (error) => subscriber.error(error);
          }
          postMessage(value);
        },
        undefined,
        undefined,
        () => worker.terminate()
      )
    );

    function postMessage(value: T | WorkerPostParams<T>): void {
      if (!hasTransferList(value)) {
        worker.postMessage(value);
        return;
      }
      worker.postMessage(value.data, value.transferList);
      return;
    }

    function hasTransferList(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      value: any
    ): value is WorkerPostParams<T> & { transferList: Transferable[] } {
      return !!value.transferList && value.transferList instanceof Array && value.transferList.length > 0;
    }
  });
}
