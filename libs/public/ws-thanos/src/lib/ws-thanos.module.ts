import { ModuleWithProviders, NgModule } from '@angular/core';
import { createWsThanosOptions } from './create-ws-thanos-options';
import { WS_THANOS_OPTIONS_TOKEN } from './ws-thanos-options.token';
import { WsThanosDirective } from './ws-thanos.directive';
import { WsThanosOptions } from './ws-thanos.options';

@NgModule({
  declarations: [WsThanosDirective],
  imports: [],
  exports: [WsThanosDirective],
})
export class WsThanosModule {
  static forRoot(
    options?: Partial<WsThanosOptions>
  ): ModuleWithProviders<WsThanosModule> {
    return {
      ngModule: WsThanosModule,
      providers: [
        {
          provide: WS_THANOS_OPTIONS_TOKEN,
          useValue: createWsThanosOptions(options),
        },
      ],
    };
  }
}
