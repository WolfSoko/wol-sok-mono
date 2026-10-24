import { DOCUMENT, Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { RESPONSE, ServerResponse } from '@analogjs/router/tokens';
import { injectSetNotFoundStatus, SITE_TAGS, usePageTags } from './site-tags';

describe('site tags', () => {
  let canonical: HTMLLinkElement;

  beforeEach(() => {
    const document = TestBed.inject(DOCUMENT);
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = SITE_TAGS.url;
    document.head.appendChild(canonical);
  });

  afterEach(() => canonical.remove());

  it('gives a page its own tags and canonical URL, until it goes', () => {
    runInInjectionContext(TestBed.inject(Injector), () =>
      usePageTags({
        title: 'Browse polls | RollaPolla',
        description: 'All the polls',
        socialDescription: 'All the polls, short',
        url: 'https://rollapolla.com/polls',
        robots: 'index, follow',
      })
    );
    const meta = TestBed.inject(Meta);

    expect(TestBed.inject(Title).getTitle()).toBe('Browse polls | RollaPolla');
    expect(meta.getTag('name="description"')?.content).toBe('All the polls');
    expect(meta.getTag('property="og:description"')?.content).toBe(
      'All the polls, short'
    );
    expect(canonical.href).toBe('https://rollapolla.com/polls');

    TestBed.resetTestingModule();

    expect(canonical.href).toBe('https://rollapolla.com/');
    expect(meta.getTag('name="description"')?.content).toBe(
      SITE_TAGS.description
    );
  });
});

describe('injectSetNotFoundStatus', () => {
  it('answers a server-rendered request with 404', () => {
    const response = { statusCode: 200, headersSent: false };
    TestBed.configureTestingModule({
      providers: [
        { provide: RESPONSE, useValue: response as unknown as ServerResponse },
      ],
    });

    TestBed.runInInjectionContext(injectSetNotFoundStatus)();

    expect(response.statusCode).toBe(404);
  });

  it('does nothing in the browser', () => {
    expect(() =>
      TestBed.runInInjectionContext(injectSetNotFoundStatus)()
    ).not.toThrow();
  });
});
