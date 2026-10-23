import { Route } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { PrivacyComponent } from './privacy/privacy.component';

/** Description and canonical path of a page, set by SeoService. */
export interface PageData {
  description: string;
}

export const appRoutes: Route[] = [
  {
    path: '',
    component: HomeComponent,
    title: 'Wolfram Sokollek – Games, Apps & Web Experiments',
    data: {
      description:
        'Portfolio of Wolfram Sokollek: Bacteria Wars, Movepath, Pacetrainer, RollaPolla and interactive Angular experiments with WebGL, shaders, TensorFlow.js and WebAssembly.',
    } satisfies PageData,
  },
  {
    path: 'privacy',
    component: PrivacyComponent,
    title: 'Datenschutzerklärung – wolsok.de',
    data: {
      description:
        'Datenschutzerklärung von wolsok.de: Hosting bei AWS, Werbung mit Google AdSense und deine Rechte.',
    } satisfies PageData,
  },
  { path: '**', redirectTo: '' },
];
