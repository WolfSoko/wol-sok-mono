import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SITE_OWNER } from '@wolsok/shared-legal';
import PrivacyPageComponent from './privacy.page';

describe('PrivacyPageComponent', () => {
  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'privacy', component: PrivacyPageComponent }]),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/privacy');
    return harness.routeNativeElement as HTMLElement;
  }

  function text(page: HTMLElement): string {
    return (page.textContent ?? '').replace(/\s+/g, ' ');
  }

  it('names who runs the site, with the address to write to', async () => {
    const page = await render();

    const controller = page.querySelector('[data-testid="privacy-controller"]');
    expect(controller?.textContent).toContain(SITE_OWNER.name);
    expect(controller?.querySelector('a')?.getAttribute('href')).toBe(
      `mailto:${SITE_OWNER.email}`
    );
  });

  it('numbers its sections in order', async () => {
    const page = await render();

    const numbers = [...page.querySelectorAll('h2')].map(
      (h2) => h2.textContent?.trim().split('.')[0]
    );
    expect(numbers).toEqual(
      Array.from({ length: numbers.length }, (_, i) => `${i + 1}`)
    );
  });

  it('says what runs only with consent, and how to withdraw it', async () => {
    const policy = text(await render());

    expect(policy).toContain(
      'Without your consent the site loads nothing from Google Analytics'
    );
    expect(policy).toContain('Without your consent the script does not load');
    expect(policy).toContain('“Privacy settings” at the bottom of every page');
    expect(policy).not.toContain('fonts.googleapis.com');
  });

  it('says how long polls, votes and chats are kept', async () => {
    const policy = text(await render());

    expect(policy).toContain(
      'deleted automatically 30 days after it was created'
    );
    expect(policy).toContain('messages in the lobby after 7 days');
  });

  it('has its own title and description', async () => {
    await render();

    expect(TestBed.inject(Title).getTitle()).toBe(
      'Privacy policy | RollaPolla'
    );
    expect(
      TestBed.inject(Meta).getTag('name="description"')?.content
    ).toContain('How RollaPolla handles your data');
    // its own canonical URL, not the home page's
    expect(TestBed.inject(Meta).getTag('property="og:url"')?.content).toBe(
      'https://rollapolla.com/privacy'
    );
  });
});
