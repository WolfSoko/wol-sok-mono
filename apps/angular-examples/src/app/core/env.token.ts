import { InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';
import { Environment } from '../../environments/environment.type';

export const ENV_TOKEN: InjectionToken<Environment> =
  new InjectionToken<Environment>('environment', {
    providedIn: 'root',
    factory: () => environment,
  });
