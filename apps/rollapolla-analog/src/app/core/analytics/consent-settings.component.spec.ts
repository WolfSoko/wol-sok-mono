import { TestBed } from '@angular/core/testing';
import { ConsentPrompt } from './consent';
import { ConsentSettingsComponent } from './consent-settings.component';

describe('ConsentSettingsComponent', () => {
  function settingsButton(element: HTMLElement): HTMLButtonElement | null {
    return element.querySelector('[data-testid="consent-settings"]');
  }

  it('stays empty where analytics does not run', async () => {
    const fixture = TestBed.createComponent(ConsentSettingsComponent);
    await fixture.whenStable();

    expect(settingsButton(fixture.nativeElement)).toBeNull();
  });

  it('asks again for consent when clicked', async () => {
    const ask = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: ConsentPrompt, useValue: { ask } }],
    });
    const fixture = TestBed.createComponent(ConsentSettingsComponent);
    await fixture.whenStable();

    settingsButton(fixture.nativeElement)?.click();

    expect(ask).toHaveBeenCalledOnce();
  });
});
