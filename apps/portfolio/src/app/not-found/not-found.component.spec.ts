import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { I18nService } from '../i18n/i18n.service';
import { NotFoundComponent } from './not-found.component';

describe('NotFoundComponent', () => {
  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: NotFoundComponent }]),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/nope');
    return harness.routeNativeElement as HTMLElement;
  }

  afterEach(() => localStorage.clear());

  it('says the page was not found and links home, in English', async () => {
    const page = await render();

    expect(page.querySelector('h1')?.textContent).toContain('Page not found');
    expect(page.querySelector('a')?.getAttribute('href')).toBe('/');
  });

  it('speaks German after a switch', async () => {
    const page = await render();
    TestBed.inject(I18nService).setLanguage('de');
    TestBed.tick();

    expect(page.querySelector('h1')?.textContent).toContain(
      'Seite nicht gefunden'
    );
    expect(page.querySelector('a')?.textContent).toContain('Zur Startseite');
  });
});
