import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import NichtGefundenPage from './[...nicht-gefunden].page';

describe('NichtGefundenPage', () => {
  async function oeffnen(pfad: string): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: NichtGefundenPage }]),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(pfad);
    return harness.routeNativeElement as HTMLElement;
  }

  it('says the page does not exist, in German', async () => {
    const seite = await oeffnen('/gibtsnicht');

    expect(seite.querySelector('h1')?.textContent?.trim()).toBe(
      'Seite nicht gefunden'
    );
    expect(seite.textContent).toContain('Diese Seite gibt es nicht (mehr).');
  });

  it('leads back to the overview', async () => {
    const seite = await oeffnen('/team/1/gibtsnicht');

    const link = seite.querySelector('a');
    expect(link?.textContent?.trim()).toBe('Zur Startseite');
    expect(link?.getAttribute('href')).toBe('/');
  });
});
