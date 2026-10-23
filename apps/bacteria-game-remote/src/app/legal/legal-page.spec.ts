import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { setUpLegalPage } from './legal-page';

@Component({
  selector: 'wolsok-legal-page-host',
  template: 'legal',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class LegalPageHostComponent {
  public constructor() {
    setUpLegalPage({ title: 'Legal - Bacteria Wars', description: 'The law' });
  }
}

describe('setUpLegalPage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'legal', component: LegalPageHostComponent },
          { path: '**', children: [] },
        ]),
      ],
    });
  });

  async function open(): Promise<void> {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/legal', LegalPageHostComponent);
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
});
