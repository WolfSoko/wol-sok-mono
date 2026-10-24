import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Repository } from './repository';
import { JSONCompatible } from '../utils/json-utils/json-utils';

@Injectable({
  providedIn: 'root',
})
export class RepositoryFactory {
  private readonly platformId = inject(PLATFORM_ID);

  /**
   * @param persist store data in localStorage (browser only). Off by default,
   * because restoring a half-finished training run is not supported yet.
   */
  public create<T extends JSONCompatible<T>>(
    localStorageKey: string,
    persist = false
  ): Repository<T> {
    return new Repository<T>(
      localStorageKey,
      persist && isPlatformBrowser(this.platformId)
    );
  }
}
