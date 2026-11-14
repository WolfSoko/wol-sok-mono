import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import NotFoundPage from './[...nicht-gefunden].page';

describe('NotFoundPage', () => {
  async function openPage(path: string): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: NotFoundPage }])],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(path);
    return harness.routeNativeElement as HTMLElement;
  }

  it('says the page does not exist, in German', async () => {
    const page = await openPage('/gibtsnicht');

    expect(page.querySelector('h1')?.textContent?.trim()).toBe(
      'Seite nicht gefunden'
    );
    expect(page.textContent).toContain('Diese Seite gibt es nicht (mehr).');
  });

  it('leads back to the overview', async () => {
    const page = await openPage('/team/1/gibtsnicht');

    const link = page.querySelector('a');
    expect(link?.textContent?.trim()).toBe('Zur Startseite');
    expect(link?.getAttribute('href')).toBe('/');
  });
});
