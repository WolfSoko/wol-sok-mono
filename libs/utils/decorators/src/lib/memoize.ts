import { Observable } from 'rxjs';

export function Memoized(resetSignal$?: Observable<void>) {
  const memoize = new Map<string, unknown>();
  resetSignal$?.subscribe(() => {
    memoize.clear();
  });

  return function (target: object, key: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: unknown[]) {
      const argsStringified: string = JSON.stringify(args);

      if (memoize.has(argsStringified)) {
        return memoize.get(argsStringified);
      }

      const result = originalMethod.apply(this, args);

      memoize.set(argsStringified, result);
      return result;
    };
    return descriptor;
  };
}
