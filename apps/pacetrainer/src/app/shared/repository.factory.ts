import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Repository } from './repository';
import { JSONCompatible } from './utils/json-utils/json-utils';

@Injectable({
  providedIn: 'root',
})
export class RepositoryFactory {
  private readonly platformId = inject(PLATFORM_ID);

  create<T extends JSONCompatible<T>>(localStorageKey: string): Repository<T> {
    return new Repository<T>(
      localStorageKey,
      isPlatformBrowser(this.platformId)
    );
  }
}
