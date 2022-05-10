import { MeasureFps } from './measure-fps';

describe('MeasureFps', () => {
  let measureFps: MeasureFps;

  beforeEach(() => {
    jest.useFakeTimers();
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

  it('should need at least 2 frameReady to emit fps', () => {
    const nextSpy = jest.fn();

    measureFps.fps$.subscribe(nextSpy);
    whenSignalFrameReadyAfterMs(100);
    whenSignalFrameReadyAfterMs(100);

    expect(nextSpy).toHaveBeenCalledTimes(1);
  });

  function warmupMeasurement(): void {
    whenSignalFrameReadyAfterMs(100);
    whenSignalFrameReadyAfterMs(100);
  }

  it('should update fps$ with moving average window of 2', () => {
    const nextSpy = jest.fn();
    measureFps = new MeasureFps(2);
    measureFps.fps$.subscribe(nextSpy);
    warmupMeasurement();

    expect(nextSpy).lastCalledWith(5);
    whenSignalFrameReadyAfterMs(100);
    expect(nextSpy).lastCalledWith(7.5);
    whenSignalFrameReadyAfterMs(50);
    expect(nextSpy).lastCalledWith(13.8);
    whenSignalFrameReadyAfterMs(50);
    expect(nextSpy).lastCalledWith(16.9);
    whenSignalFrameReadyAfterMs(150);
    expect(nextSpy).lastCalledWith(11.8);
    whenSignalFrameReadyAfterMs(50);
    expect(nextSpy).lastCalledWith(15.9);
    whenSignalFrameReadyAfterMs(50);
    expect(nextSpy).lastCalledWith(18);
    whenSignalFrameReadyAfterMs(50);
    expect(nextSpy).lastCalledWith(19);
    whenSignalFrameReadyAfterMs(50);
    expect(nextSpy).lastCalledWith(19.5);
    whenSignalFrameReadyAfterMs(50);
    expect(nextSpy).lastCalledWith(19.8);
    whenSignalFrameReadyAfterMs(50);
    expect(nextSpy).lastCalledWith(19.9);
    whenSignalFrameReadyAfterMs(50);
    expect(nextSpy).lastCalledWith(20.0);
    whenSignalFrameReadyAfterMs(100);
    expect(nextSpy).lastCalledWith(15.0);
  });

  it('should ignore 0 measurement ', () => {
    const nextSpy = jest.fn();
    measureFps.fps$.subscribe(nextSpy);
    warmupMeasurement();
    expect(nextSpy).lastCalledWith(0.1);
    measureFps.signalFrameReady();
    expect(nextSpy).lastCalledWith(0.1);
  });

  function whenSignalFrameReadyAfterMs(ms: number): void {
    jest.advanceTimersByTime(ms);
    measureFps.signalFrameReady();
  }
});
