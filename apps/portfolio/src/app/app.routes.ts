import { Route } from '@angular/router';
import { blogRoutes } from './blog/blog.routes';
import { ANGULAR_SINCE, CAREER_SINCE } from './career/career-since';
import { HomeComponent } from './home/home.component';
import { PageData } from './page-data';

/** The start page's title and description. */
export const HOME_PAGE: PageData = {
  title: {
    en: 'Wolfram Sokollek – Freelance Full-Stack Software Engineer',
    de: 'Wolfram Sokollek – Freiberuflicher Fullstack Software Engineer',
  },
  description: {
    en: `Freelance full-stack software engineer in Hamburg since ${CAREER_SINCE}: Angular web apps from idea to production, with live apps, games and open source to explore.`,
    de: `Freiberuflicher Fullstack Software Engineer in Hamburg seit ${CAREER_SINCE}: Angular-Web-Apps von der Idee bis in Produktion, mit Live-Apps, Spielen und Open Source.`,
  },
};

export const appRoutes: Route[] = [
  {
    path: '',
    component: HomeComponent,
    data: HOME_PAGE,
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
        en: `Freelance full-stack software engineer since ${CAREER_SINCE}, Angular since ${ANGULAR_SINCE}: projects for Otto, freenet, About You, Fielmann and more, skills, industries and how to get in touch.`,
        de: `Freiberuflicher Fullstack Software Engineer seit ${CAREER_SINCE}, Angular seit ${ANGULAR_SINCE}: Projekte für Otto, freenet, About You, Fielmann und mehr, Kenntnisse, Branchen und Kontakt.`,
      },
    } satisfies PageData,
  },
  ...blogRoutes,
  {
    path: 'privacy',
    loadComponent: () =>
      import('./privacy/privacy.component').then((m) => m.PrivacyComponent),
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
  {
    path: 'impressum',
    loadComponent: () =>
      import('./impressum/impressum.component').then(
        (m) => m.ImpressumComponent
      ),
    data: {
      title: {
        en: 'Legal notice (Impressum) – wolsok.de',
        de: 'Impressum – wolsok.de',
      },
      description: {
        en: 'Legal notice of wolsok.de: who runs the site, postal address and contact.',
        de: 'Impressum von wolsok.de: Anbieter, Anschrift und Kontakt.',
      },
    } satisfies PageData,
  },
  {
    path: '**',
    loadComponent: () =>
      import('./not-found/not-found.component').then(
        (m) => m.NotFoundComponent
      ),
    data: {
      title: {
        en: 'Page not found – wolsok.de',
        de: 'Seite nicht gefunden – wolsok.de',
      },
      description: {
        en: 'There is no page at this address on wolsok.de.',
        de: 'Unter dieser Adresse gibt es auf wolsok.de keine Seite.',
      },
      noindex: true,
    } satisfies PageData,
  },
];
