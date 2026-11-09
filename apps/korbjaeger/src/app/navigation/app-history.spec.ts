import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { routerIdle } from '../../testing/router-idle';
import { AppHistory } from './app-history';

@Component({ template: '' })
class AnyPage {}

interface Setup {
  readonly history: AppHistory;
  readonly router: Router;
  readonly location: Location;
  /** Waits until the navigation `location` started is done. */
  settle(): Promise<void>;
}

async function setup(start = '/'): Promise<Setup> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', component: AnyPage }]),
      provideLocationMocks(),
    ],
  });
  const history = TestBed.inject(AppHistory);
  const router = TestBed.inject(Router);
  const location = TestBed.inject(Location);
  // listens to the browser's back and forward, as the app's start does
  location.replaceState(start);
  router.initialNavigation();
  const settle = () => routerIdle(router);
  await settle();
  return { history, router, location, settle };
}

describe('AppHistory', () => {
  it('has nothing behind or ahead on the first page', async () => {
    const { history } = await setup();

    expect(history.canGoBack()).toBe(false);
    expect(history.canGoForward()).toBe(false);
  });

  it('goes back and forward through the pages this start opened', async () => {
    const { history, router, location, settle } = await setup();
    await router.navigateByUrl('/team/1');
    await router.navigateByUrl('/spiel/2');
    expect(history.canGoBack()).toBe(true);
    expect(history.canGoForward()).toBe(false);

    history.back();
    await settle();
    expect(location.path()).toBe('/team/1');
    expect(history.canGoForward()).toBe(true);

    history.forward();
    await settle();
    expect(location.path()).toBe('/spiel/2');
    expect(history.canGoForward()).toBe(false);
  });

  it('keeps track over several rounds of back and forward', async () => {
    const { history, router, location, settle } = await setup();
    await router.navigateByUrl('/team/1');
    await router.navigateByUrl('/spiel/2');

    for (let round = 0; round < 3; round++) {
      history.back();
      await settle();
      expect(location.path()).toBe('/team/1');
      expect(history.canGoForward()).toBe(true);
      history.forward();
      await settle();
      expect(location.path()).toBe('/spiel/2');
    }
    history.back();
    await settle();
    history.back();
    await settle();

    expect(location.path()).toBe('/');
    expect(history.canGoBack()).toBe(false);
    expect(history.canGoForward()).toBe(true);
  });

  it('stays where nothing lies behind or ahead', async () => {
    const { history, location, settle } = await setup();

    history.back();
    history.forward();
    await settle();

    expect(location.path()).toBe('/');
  });

  it('drops what lay ahead once a new page is opened after going back', async () => {
    const { history, router, settle } = await setup();
    await router.navigateByUrl('/team/1');
    history.back();
    await settle();

    await router.navigateByUrl('/impressum');

    expect(history.canGoForward()).toBe(false);
  });

  it('keeps the entry of a navigation that replaces the URL', async () => {
    const { history, router } = await setup();
    await router.navigateByUrl('/team/1');

    await router.navigateByUrl('/team/2', { replaceUrl: true });

    expect(history.canGoBack()).toBe(true);
    expect(history.canGoForward()).toBe(false);
  });
});
