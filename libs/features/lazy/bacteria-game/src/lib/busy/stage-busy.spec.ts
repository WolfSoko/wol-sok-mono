import { ApplicationRef, ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StageBusy } from './stage-busy';

describe('StageBusy', () => {
  let busy: StageBusy;

  beforeEach(() => {
    busy = TestBed.inject(StageBusy);
  });

  async function settle(): Promise<void> {
    await TestBed.inject(ApplicationRef).whenStable();
  }

  it('shows the indicator before the work runs, and clears it after', async () => {
    const work = jest.fn(() => {
      // The indicator is up while the work runs.
      expect(busy.active()).toBe(true);
    });

    busy.run(work);

    expect(busy.active()).toBe(true);
    expect(work).not.toHaveBeenCalled();
    await settle();
    expect(work).toHaveBeenCalledTimes(1);
    expect(busy.active()).toBe(false);
  });

  it('drops a second tap while the first one is under way', async () => {
    const first = jest.fn();
    const second = jest.fn();

    busy.run(first);
    busy.run(second);
    await settle();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it('stays busy until work that takes its time is through', async () => {
    let finish = (): void => undefined;
    const started = new Promise<void>((resolveStarted) => {
      busy.run(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
            resolveStarted();
          })
      );
    });

    await started;
    expect(busy.active()).toBe(true);
    finish();
    await settle();
    expect(busy.active()).toBe(false);
  });

  it('reports work that fails, and is no longer busy', async () => {
    // As in the app: the failure goes to the error handler, not to the test.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ rethrowApplicationErrors: false });
    busy = TestBed.inject(StageBusy);
    const handleError = jest.spyOn(TestBed.inject(ErrorHandler), 'handleError');
    handleError.mockImplementation(() => undefined);
    const error = new Error('broken');

    busy.run(() => {
      throw error;
    });
    await settle();

    expect(handleError).toHaveBeenCalledWith(error);
    expect(busy.active()).toBe(false);
  });
});
