import { InjectionToken, Provider } from '@angular/core';
import { createWsThanosOptions } from './create-ws-thanos-options';
import type { WsThanosOptions } from './ws-thanos.options';

export const WS_THANOS_OPTIONS_TOKEN = new InjectionToken<WsThanosOptions>('thanosOptions', {
  providedIn: 'root',
  factory: () => createWsThanosOptions(),
});

export function provideWsThanosOptions(options?: Partial<WsThanosOptions>): Provider {
  return {
    provide: WS_THANOS_OPTIONS_TOKEN,
    useValue: createWsThanosOptions(options),
  };
}
