import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConsentPrompt } from './consent';
import { ConsentBannerComponent } from './consent-banner.component';

describe('ConsentBannerComponent', () => {
  async function render(prompt?: Partial<ConsentPrompt>): Promise<HTMLElement> {
    if (prompt) {
      TestBed.configureTestingModule({
        providers: [{ provide: ConsentPrompt, useValue: prompt }],
      });
    }
    const fixture = TestBed.createComponent(ConsentBannerComponent);
    await fixture.whenStable();
    return fixture.nativeElement;
  }

  function byTestId(element: HTMLElement, testId: string): HTMLElement | null {
    return element.querySelector(`[data-testid="${testId}"]`);
  }

  it('stays empty where analytics does not run', async () => {
    expect(byTestId(await render(), 'consent-banner')).toBeNull();
  });

  it('stays hidden while not asking', async () => {
    const element = await render({ asking: signal(false) });

    expect(byTestId(element, 'consent-banner')).toBeNull();
  });

  it.each([
    ['consent-accept', 'granted'],
    ['consent-decline', 'denied'],
  ])('passes on the choice when %s is clicked', async (testId, choice) => {
    const decide = vi.fn();
    const element = await render({ asking: signal(true), decide });

    byTestId(element, testId)?.click();

    expect(decide).toHaveBeenCalledExactlyOnceWith(choice);
  });
});
