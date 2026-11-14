import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  SwUpdate,
  type UnrecoverableStateEvent,
} from '@angular/service-worker';
import { Subject } from 'rxjs';
import { provideAppServiceWorker, RELOAD_PAGE } from './app-service-worker';

describe('provideAppServiceWorker', () => {
  let unrecoverable: Subject<UnrecoverableStateEvent>;
  let reload: ReturnType<typeof vi.fn<() => void>>;

  async function start(isEnabled: boolean): Promise<void> {
    unrecoverable = new Subject();
    reload = vi.fn<() => void>();
    TestBed.configureTestingModule({
      providers: [
        provideAppServiceWorker(),
        { provide: SwUpdate, useValue: { isEnabled, unrecoverable } },
        { provide: RELOAD_PAGE, useValue: reload },
      ],
    });
    await TestBed.inject(ApplicationInitStatus).donePromise;
  }

  it('reloads the page once the worker lost files of the release it serves', async () => {
    // a chunk of the running release gone from cache and server alike
    await start(true);

    unrecoverable.next({
      type: 'UNRECOVERABLE_STATE',
      reason: 'hash mismatch',
    });

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('listens to no worker where none runs (dev server, specs)', async () => {
    await start(false);

    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'never' });

    expect(reload).not.toHaveBeenCalled();
  });
});
