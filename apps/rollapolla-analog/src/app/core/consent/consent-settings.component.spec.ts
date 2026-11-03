import { TestBed } from '@angular/core/testing';
import { ConsentPrompt, StoredConsent } from '@wolsok/shared-analytics';
import { AD_CONSENT } from './ad-consent';
import { ConsentSettingsComponent } from './consent-settings.component';

describe('ConsentSettingsComponent', () => {
  function settingsButton(element: HTMLElement): HTMLButtonElement | null {
    return element.querySelector('[data-testid="consent-settings"]');
  }

  it('stays empty where nothing asks for consent', async () => {
    const fixture = TestBed.createComponent(ConsentSettingsComponent);
    await fixture.whenStable();

    expect(settingsButton(fixture.nativeElement)).toBeNull();
  });

  it('asks again for every purpose when clicked', async () => {
    const statistics = new StoredConsent('test-stats', () => undefined);
    const ads = new StoredConsent('test-ads', () => undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: ConsentPrompt, useValue: statistics },
        { provide: AD_CONSENT, useValue: ads },
      ],
    });
    const fixture = TestBed.createComponent(ConsentSettingsComponent);
    await fixture.whenStable();

    settingsButton(fixture.nativeElement)?.click();

    expect(statistics.asking()).toBe(true);
    expect(ads.asking()).toBe(true);
  });
});
