import { InjectionToken } from '@angular/core';
import { createWsThanosOptions } from './create-ws-thanos-options';
import { WsThanosOptions } from './ws-thanos.options';

export const WS_THANOS_OPTIONS_TOKEN = new InjectionToken<WsThanosOptions>(
  'thanosOptions',
  {
    providedIn: 'root',
    factory: createWsThanosOptions,
  }
);
