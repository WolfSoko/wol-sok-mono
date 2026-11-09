import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  SwUpdate,
  type UnrecoverableStateEvent,
} from '@angular/service-worker';
import { Subject } from 'rxjs';
import { provideAppServiceWorker, SEITE_NEU_LADEN } from './app-service-worker';

describe('provideAppServiceWorker', () => {
  let unrecoverable: Subject<UnrecoverableStateEvent>;
  let neuLaden: ReturnType<typeof vi.fn<() => void>>;

  async function starten(isEnabled: boolean): Promise<void> {
    unrecoverable = new Subject();
    neuLaden = vi.fn<() => void>();
    TestBed.configureTestingModule({
      providers: [
        provideAppServiceWorker(),
        { provide: SwUpdate, useValue: { isEnabled, unrecoverable } },
        { provide: SEITE_NEU_LADEN, useValue: neuLaden },
      ],
    });
    await TestBed.inject(ApplicationInitStatus).donePromise;
  }

  it('reloads the page once the worker lost files of the release it serves', async () => {
    // a chunk of the running release gone from cache and server alike
    await starten(true);

    unrecoverable.next({
      type: 'UNRECOVERABLE_STATE',
      reason: 'hash mismatch',
    });

    expect(neuLaden).toHaveBeenCalledTimes(1);
  });

  it('listens to no worker where none runs (dev server, specs)', async () => {
    await starten(false);

    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'never' });

    expect(neuLaden).not.toHaveBeenCalled();
  });
});
