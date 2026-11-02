// The game lib's entry point loads Firebase, whose Node build needs fetch,
// which jsdom lacks.
import 'cross-fetch/polyfill';
import { setupZonelessTestEnv } from 'jest-preset-angular/setup-env/zoneless';

setupZonelessTestEnv();
