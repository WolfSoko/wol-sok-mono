import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { EMAIL_FORWARDING } from '@wolsok/shared-legal';
import { PrivacyComponent } from './privacy.component';

describe('PrivacyComponent', () => {
  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'privacy', component: PrivacyComponent }]),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/privacy');
    return harness.routeNativeElement as HTMLElement;
  }

  function text(page: HTMLElement, testId: string): string {
    return (
      page.querySelector(`[data-testid="${testId}"]`)?.textContent ?? ''
    ).replace(/\s+/g, ' ');
  }

  it('names the forwarding of emails through ImprovMX to Gmail, in German and English', async () => {
    const page = await render();
    const { forwarder, inbox } = EMAIL_FORWARDING;

    for (const testId of ['privacy-email-de', 'privacy-email-en']) {
      expect(text(page, testId)).toContain(
        `${forwarder.company}, ${forwarder.address}`
      );
      expect(text(page, testId)).toContain(inbox.company);
    }
    expect(text(page, 'privacy-email-de')).toContain('in den USA');
    expect(text(page, 'privacy-email-en')).toContain('in the USA');
  });
});
