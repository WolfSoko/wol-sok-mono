import { Injectable, signal } from '@angular/core';
import { DEFAULT_FEATURES, FeatureToggles } from '../../shared/app-config';
import { AppConfigPort } from '../ports/app-config.port';

@Injectable()
export class AppConfigAdapterMock extends AppConfigPort {
  public readonly features = signal<FeatureToggles>(DEFAULT_FEATURES);
}
