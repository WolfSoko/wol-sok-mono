import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  SwUpdate,
  UnrecoverableStateEvent,
  VersionEvent,
} from '@angular/service-worker';
import { Subject } from 'rxjs';
import { providePwaUpdates, RELOAD_PAGE } from './pwa-updates';

const VERSION_READY: VersionEvent = {
  type: 'VERSION_READY',
  currentVersion: { hash: 'old' },
  latestVersion: { hash: 'new' },
};

describe('providePwaUpdates', () => {
  let versionUpdates: Subject<VersionEvent>;
  let unrecoverable: Subject<UnrecoverableStateEvent>;
  let snackAction: Subject<void>;
  let snackBar: { open: jest.Mock };
  let checkForUpdate: jest.Mock;
  let reloadPage: jest.Mock;

  async function setUp(isEnabled: boolean): Promise<void> {
    versionUpdates = new Subject();
    unrecoverable = new Subject();
    snackAction = new Subject();
    snackBar = {
      open: jest.fn(() => ({ onAction: () => snackAction })),
    };
    checkForUpdate = jest.fn(() => Promise.resolve(false));
    reloadPage = jest.fn();
    TestBed.configureTestingModule({
      providers: [
        providePwaUpdates(),
        {
          provide: SwUpdate,
          useValue: {
            isEnabled,
            versionUpdates,
            unrecoverable,
            checkForUpdate,
          },
        },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: RELOAD_PAGE, useValue: reloadPage },
      ],
    });
    await TestBed.inject(ApplicationInitStatus).donePromise;
  }

  afterEach(() => jest.useRealTimers());

  it('offers a reload once a new version is ready', async () => {
    await setUp(true);

    versionUpdates.next({
      type: 'VERSION_DETECTED',
      version: { hash: 'new' },
    });
    expect(snackBar.open).not.toHaveBeenCalled();

    versionUpdates.next(VERSION_READY);
    expect(snackBar.open).toHaveBeenCalledWith(
      'A new version of the game is ready',
      'Reload'
    );
    expect(reloadPage).not.toHaveBeenCalled();

    snackAction.next();
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it('reloads when the service worker cannot serve the app any more', async () => {
    await setUp(true);

    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'broken' });
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it('looks for a new version every hour', async () => {
    jest.useFakeTimers();
    await setUp(true);
    await jest.advanceTimersByTimeAsync(0);
    expect(checkForUpdate).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a service worker', async () => {
    await setUp(false);

    versionUpdates.next(VERSION_READY);
    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'broken' });
    expect(snackBar.open).not.toHaveBeenCalled();
    expect(reloadPage).not.toHaveBeenCalled();
  });
});
