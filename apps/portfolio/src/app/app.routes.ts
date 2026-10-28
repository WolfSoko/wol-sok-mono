import { Route } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { Localized } from './i18n/language';
import { PrivacyComponent } from './privacy/privacy.component';

/** Title and description of a page in every language, set by SeoService. */
export interface PageData {
  title: Localized;
  description: Localized;
}

export const appRoutes: Route[] = [
  {
    path: '',
    component: HomeComponent,
    data: {
      title: {
        en: 'Wolfram Sokollek – Games, Apps & Web Experiments',
        de: 'Wolfram Sokollek – Spiele, Apps & Web-Experimente',
      },
      description: {
        en: 'Portfolio of Wolfram Sokollek: Bacteria Wars, Movepath, Pacetrainer, RollaPolla and interactive Angular experiments with WebGL, shaders, TensorFlow.js and WebAssembly.',
        de: 'Portfolio von Wolfram Sokollek: Bacteria Wars, Movepath, Pacetrainer, RollaPolla und interaktive Angular-Experimente mit WebGL, Shadern, TensorFlow.js und WebAssembly.',
      },
    } satisfies PageData,
  },
  {
    path: 'career',
    loadComponent: () =>
      import('./career/career.component').then((m) => m.CareerComponent),
    data: {
      title: {
        en: 'Career – Wolfram Sokollek, freelance full-stack engineer',
        de: 'Werdegang – Wolfram Sokollek, freiberuflicher Fullstack-Engineer',
      },
      description: {
        en: 'Freelance full-stack software engineer since 2008, Angular since 2014: projects for Otto, freenet, About You, Fielmann and more, skills, industries and how to get in touch.',
        de: 'Freiberuflicher Fullstack Software Engineer seit 2008, Angular seit 2014: Projekte für Otto, freenet, About You, Fielmann und mehr, Kenntnisse, Branchen und Kontakt.',
      },
    } satisfies PageData,
  },
  {
    path: 'privacy',
    component: PrivacyComponent,
    data: {
      title: {
        en: 'Datenschutzerklärung – wolsok.de',
        de: 'Datenschutzerklärung – wolsok.de',
      },
      description: {
        en: 'Privacy policy of wolsok.de: hosting on AWS, ads through Google AdSense and your rights.',
        de: 'Datenschutzerklärung von wolsok.de: Hosting bei AWS, Werbung mit Google AdSense und deine Rechte.',
      },
    } satisfies PageData,
  },
  { path: '**', redirectTo: '' },
];
