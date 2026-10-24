// Test helper: the test setup's IntersectionObserver never reports anything.
/** Lets the test say when the observed element comes into view. */
export function stubIntersectionObserver(): (inView: boolean) => void {
  const callbacks: IntersectionObserverCallback[] = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        callbacks.push(callback);
      }
      public observe(): void {}
      public disconnect(): void {}
    }
  );
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
  return (inView) =>
    callbacks.forEach((callback) =>
      callback(
        [{ isIntersecting: inView } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    );
}
