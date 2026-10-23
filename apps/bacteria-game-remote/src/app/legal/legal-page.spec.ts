import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { setUpLegalPage } from './legal-page';

@Component({
  selector: 'wolsok-legal-page-host',
  template: '<h1 id="de">Recht</h1><h1 id="en">Law</h1>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class LegalPageHostComponent {
  public readonly page = setUpLegalPage({
    title: 'Legal - Bacteria Wars',
    description: 'The law',
  });
}

describe('setUpLegalPage', () => {
  let scrolledTo: string[];

  beforeEach(() => {
    scrolledTo = [];
    // jsdom has no layout, so no scrollIntoView either.
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolledTo.push(this.id);
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'legal', component: LegalPageHostComponent },
          { path: '**', children: [] },
        ]),
      ],
    });
  });

  async function open(url = '/legal'): Promise<LegalPageHostComponent> {
    const harness = await RouterTestingHarness.create();
    return harness.navigateByUrl(url, LegalPageHostComponent);
  }

  it('sets the title, description and the canonical URL of the route, and puts them back', async () => {
    const title = TestBed.inject(Title);
    const meta = TestBed.inject(Meta);
    const doc = TestBed.inject(DOCUMENT);
    title.setTitle('Bacteria Game');
    meta.updateTag({ name: 'description', content: 'The game' });

    await open();

    expect(title.getTitle()).toBe('Legal - Bacteria Wars');
    expect(meta.getTag('name="description"')?.content).toBe('The law');
    expect(
      doc.head.querySelector('link[rel="canonical"]')?.getAttribute('href')
    ).toBe('https://bacteria-wars.wolsok.de/legal');

    await TestBed.inject(Router).navigateByUrl('/');

    expect(title.getTitle()).toBe('Bacteria Game');
    expect(meta.getTag('name="description"')?.content).toBe('The game');
    expect(doc.head.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it('takes the loading screen down, as no game will', async () => {
    const doc = TestBed.inject(DOCUMENT);
    const splash = doc.createElement('div');
    splash.id = 'bacteria-game-splash';
    doc.body.append(splash);

    await open();

    expect(splash.isConnected).toBe(false);
  });

  it('scrolls to the section the URL names, and to one on request', async () => {
    const host = await open('/legal#en');
    expect(scrolledTo).toEqual(['en']);

    host.page.scrollTo('de');

    expect(scrolledTo).toEqual(['en', 'de']);
  });
});
