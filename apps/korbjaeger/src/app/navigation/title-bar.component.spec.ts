import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routerIdle } from '../../testing/router-idle';
import { breadcrumb } from './breadcrumb';
import { TitleBarComponent } from './title-bar.component';

@Component({ template: '' })
class OverviewPage {}

@Component({ template: '' })
class TeamPage {
  public constructor() {
    breadcrumb(() => [{ title: 'MTV Wasbüttel U12' }]);
  }
}

@Component({ template: '' })
class SpielPage {
  public constructor() {
    breadcrumb(() => [
      { title: 'MTV Wasbüttel U12', link: ['/team', '1'] },
      { title: 'Spiel' },
    ]);
  }
}

interface Setup {
  readonly bar: HTMLElement;
  readonly router: Router;
  readonly location: Location;
  /** Waits for running navigations, then renders the bar. */
  settle(): Promise<void>;
}

async function setup(start: string): Promise<Setup> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: '', component: OverviewPage },
        { path: 'team/:id', component: TeamPage },
        { path: 'spiel/:id', component: SpielPage },
      ]),
      provideLocationMocks(),
    ],
  });
  const router = TestBed.inject(Router);
  const location = TestBed.inject(Location);
  const fixture = TestBed.createComponent(TitleBarComponent);
  // the bar's pages need an outlet; the router's own test harness has one
  await RouterTestingHarness.create();
  location.replaceState(start);
  router.initialNavigation();
  const settle = async () => {
    await routerIdle(router);
    await fixture.whenStable();
  };
  await settle();
  return {
    bar: fixture.nativeElement as HTMLElement,
    router,
    location,
    settle,
  };
}

function levels(bar: HTMLElement): string[] {
  return [...bar.querySelectorAll('nav[aria-label="Seitenpfad"] li')].map(
    (li) => li.textContent?.trim() ?? ''
  );
}

function button(bar: HTMLElement, label: 'Zurück' | 'Vor'): HTMLButtonElement {
  const found = bar.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`
  );
  if (found === null) {
    throw new Error(`no button ${label}`);
  }
  return found;
}

describe('TitleBarComponent', () => {
  it('shows the overview alone as the current page, with neither back nor forward', async () => {
    const { bar } = await setup('/');

    expect(levels(bar)).toEqual(['Korbjäger']);
    expect(
      bar.querySelector('[aria-current="page"]')?.textContent?.trim()
    ).toBe('Korbjäger');
    expect(button(bar, 'Zurück').disabled).toBe(true);
    expect(button(bar, 'Vor').disabled).toBe(true);
  });

  it('links every level above the page, the page itself as text', async () => {
    const { bar } = await setup('/spiel/2');

    expect(levels(bar)).toEqual(['Korbjäger', 'MTV Wasbüttel U12', 'Spiel']);
    const links = [...bar.querySelectorAll('nav a')].map((a) =>
      a.getAttribute('href')
    );
    expect(links).toEqual(['/', '/team/1']);
    expect(
      bar.querySelector('[aria-current="page"]')?.textContent?.trim()
    ).toBe('Spiel');
  });

  it('goes up from a page opened directly', async () => {
    const { bar, location, settle } = await setup('/spiel/2');

    expect(button(bar, 'Zurück').disabled).toBe(false);
    button(bar, 'Zurück').click();
    await settle();

    expect(location.path()).toBe('/team/1');
    expect(levels(bar)).toEqual(['Korbjäger', 'MTV Wasbüttel U12']);
    // up is a new entry, so back returns to the Spiel
    button(bar, 'Zurück').click();
    await settle();
    expect(location.path()).toBe('/spiel/2');
  });

  it('goes back and forward through the pages opened', async () => {
    const { bar, router, location, settle } = await setup('/');
    await router.navigateByUrl('/team/1');
    await router.navigateByUrl('/spiel/2');
    await settle();

    button(bar, 'Zurück').click();
    await settle();
    expect(location.path()).toBe('/team/1');
    expect(button(bar, 'Vor').disabled).toBe(false);

    button(bar, 'Vor').click();
    await settle();
    expect(location.path()).toBe('/spiel/2');
    expect(button(bar, 'Vor').disabled).toBe(true);
  });

  it('offers the settings', async () => {
    const { bar } = await setup('/');

    expect(
      bar.querySelector('[aria-label="Einstellungen"]')?.getAttribute('href')
    ).toBe('/einstellungen');
  });
});
