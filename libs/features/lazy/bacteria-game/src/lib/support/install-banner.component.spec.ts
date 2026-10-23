import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '../i18n/i18n.service';
import { InstallBannerComponent } from './install-banner.component';
import { InstallOffer, InstallPlatform } from './install-offer.service';

describe('InstallBannerComponent', () => {
  const visible = signal(true);
  const canInstallWebApp = signal(false);
  let offer: {
    visible: typeof visible;
    canInstallWebApp: typeof canInstallWebApp;
    platform: InstallPlatform;
    storeUrl: string | null;
    installWebApp: jest.Mock;
    dismiss: jest.Mock;
  };

  beforeEach(() => {
    visible.set(true);
    canInstallWebApp.set(false);
    offer = {
      visible,
      canInstallWebApp,
      platform: 'android',
      storeUrl:
        'https://play.google.com/store/apps/details?id=de.wolsok.bacteriawars',
      installWebApp: jest.fn(),
      dismiss: jest.fn(),
    };
  });

  function render(): HTMLElement {
    TestBed.configureTestingModule({
      providers: [{ provide: InstallOffer, useValue: offer }],
    });
    const fixture = TestBed.createComponent(InstallBannerComponent);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('sends an Android player to Google Play, in a tab of its own', () => {
    const host = render();
    const link = host.querySelector<HTMLAnchorElement>('a.store');

    expect(host.textContent).toContain('Play Bacteria Wars as an app');
    expect(host.textContent).toContain('get the app on Google Play');
    expect(link?.href).toBe(offer.storeUrl);
    expect(link?.target).toBe('_blank');
    expect(host.querySelector('.web-app')).toBeNull();
  });

  it('installs the web app where the browser offers to', () => {
    offer.platform = 'other';
    canInstallWebApp.set(true);
    const host = render();

    expect(host.textContent).toContain('install the web app');
    expect(host.querySelector('a.store')).toBeNull();
    host.querySelector<HTMLButtonElement>('.web-app')?.click();

    expect(offer.installWebApp).toHaveBeenCalled();
  });

  it('tells an iOS player the way to the home screen, in German too', () => {
    offer.platform = 'ios';
    const host = render();
    expect(host.textContent).toContain('Add to Home Screen');

    TestBed.inject(I18nService).setLanguage('de');
    TestBed.tick();

    expect(host.textContent).toContain('Zum Home-Bildschirm');
    expect(host.querySelector('[aria-label="Später"]')).not.toBeNull();
  });

  it('is dismissed with its close button, and gone without an offer', () => {
    const host = render();

    host.querySelector<HTMLButtonElement>('[aria-label="Not now"]')?.click();
    expect(offer.dismiss).toHaveBeenCalled();

    visible.set(false);
    TestBed.tick();
    expect(host.querySelector('.banner')).toBeNull();
  });
});
