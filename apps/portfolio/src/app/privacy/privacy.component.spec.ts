import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
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

  it('names the forwarding of emails, in German and English', async () => {
    const page = await render();

    expect(text(page, 'privacy-email-de')).toContain(
      'leitet der Dienst ImprovMX'
    );
    expect(text(page, 'privacy-email-en')).toContain(
      'forwards the message to our Gmail inbox'
    );
  });
});
