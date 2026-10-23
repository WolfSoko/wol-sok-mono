import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SITE_OWNER } from '../legal/site-owner';
import { ImpressumComponent } from './impressum.component';

describe('ImpressumComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'impressum', component: ImpressumComponent }]),
      ],
    });
  });

  async function open(): Promise<HTMLElement> {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/impressum', ImpressumComponent);
    return harness.routeNativeElement as HTMLElement;
  }

  it('names the provider in German and English, with a way to reach them', async () => {
    const page = await open();

    expect(page.querySelector('article[lang="de"] h1')?.textContent).toBe(
      'Impressum'
    );
    expect(page.querySelector('article[lang="en"] h1')?.textContent).toBe(
      'Legal notice'
    );
    const owners = Array.from(page.querySelectorAll('address')).map((address) =>
      address.textContent?.replace(/\s+/g, ' ').trim()
    );
    expect(owners).toHaveLength(2);
    expect(owners[0]).toContain(SITE_OWNER.name);
    expect(owners[0]).toContain(`E-Mail: ${SITE_OWNER.email}`);
    expect(owners[1]).toContain(`Email: ${SITE_OWNER.email}`);
    expect(page.querySelector('a[href="/privacy"]')).not.toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('Impressum - Bacteria Wars');
  });
});
