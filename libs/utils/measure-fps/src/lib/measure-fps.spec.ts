import { MeasureFps } from './measure-fps';

function makePerformanceWritableToLetUseFakeTimersWork(): void {
  Object.defineProperty(globalThis, 'performance', {
    writable: true,
  });
}

describe('MeasureFps', () => {
  let measureFps: MeasureFps;

  beforeEach(() => {
    makePerformanceWritableToLetUseFakeTimersWork();
    jest.useFakeTimers({});
    measureFps = new MeasureFps();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should work', () => {
    expect(measureFps).toBeDefined();
  });

  it('should have fps$ observable', () => {
    expect(measureFps.fps$).toBeDefined();
  });

  it('should need at least 300ms to emit fps', () => {
    const nextSpy = jest.fn();

    measureFps.fps$.subscribe(nextSpy);
    whenSignalFrameReadyAfterMs(100);
    whenSignalFrameReadyAfterMs(100);
    whenSignalFrameReadyAfterMs(100);

    expect(nextSpy).toHaveBeenCalledTimes(1);
  });

  it('should update fps$ with average window of 200ms', () => {
    const nextSpy = jest.fn();
    measureFps = new MeasureFps(200);
    measureFps.fps$.subscribe(nextSpy);
    warmupMeasurement();

    whenSignalFrameReadyAfterMs(100);
    expect(nextSpy).toHaveBeenLastCalledWith(5);
    whenSignalFrameReadyAfterMs(50);
    whenSignalFrameReadyAfterMs(50);
    whenSignalFrameReadyAfterMs(100);
    expect(nextSpy).toHaveBeenLastCalledWith(6.7);
    whenSignalFrameReadyAfterMs(50);
    whenSignalFrameReadyAfterMs(50);
    whenSignalFrameReadyAfterMs(50);
    whenSignalFrameReadyAfterMs(50);
    expect(nextSpy).toHaveBeenLastCalledWith(15);
    whenSignalFrameReadyAfterMs(50);
    whenSignalFrameReadyAfterMs(50);
    whenSignalFrameReadyAfterMs(50);
    whenSignalFrameReadyAfterMs(50);
    expect(nextSpy).toHaveBeenLastCalledWith(20.0);
  });

  it('should ignore 0 measurement ', () => {
    const nextSpy = jest.fn();
    measureFps.fps$.subscribe(nextSpy);
    warmupMeasurement();
    expect(nextSpy).toHaveBeenLastCalledWith(5);
    measureFps.signalFrameReady();
    expect(nextSpy).toHaveBeenLastCalledWith(5);
  });

  it('should provide frameTime in milliseconds', () => {
    const nextSpy = jest.fn();
    measureFps.frameTimeMs$.subscribe(nextSpy);
    warmupMeasurement();
    expect(nextSpy).toHaveBeenLastCalledWith(201);
    whenSignalFrameReadyAfterMs(500);
    expect(nextSpy).toHaveBeenLastCalledWith(300);
  });

  function whenSignalFrameReadyAfterMs(ms: number): void {
    jest.advanceTimersByTime(ms);
    measureFps.signalFrameReady();
  }

  function warmupMeasurement(): void {
    whenSignalFrameReadyAfterMs(1);
    whenSignalFrameReadyAfterMs(101);
    whenSignalFrameReadyAfterMs(201);
    whenSignalFrameReadyAfterMs(300);
  }
});
