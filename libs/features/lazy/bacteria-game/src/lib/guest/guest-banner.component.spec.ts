import { TestBed } from '@angular/core/testing';
import { FakeGameAccount } from '../../testing/fake-game-account';
import { LateGameStorage } from '../../testing/late-game-storage';
import { GameAccount } from '../storage/game-account';
import { DeviceStorage, GameStorage } from '../storage/game-storage';
import { GuestBannerComponent } from './guest-banner.component';
import { GuestNotice } from './guest-notice.service';

describe('GuestBannerComponent', () => {
  let account: FakeGameAccount;

  async function render() {
    TestBed.resetTestingModule();
    account = new FakeGameAccount();
    account.profile.set({ guest: true, name: null });
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAccount, useValue: account },
        { provide: GameStorage, useValue: account.storage },
        { provide: DeviceStorage, useValue: new LateGameStorage() },
      ],
    });
    const fixture = TestBed.createComponent(GuestBannerComponent);
    account.flush();
    await fixture.whenStable();
    return fixture;
  }

  const buttons = (element: HTMLElement): HTMLButtonElement[] =>
    Array.from(element.querySelectorAll('button'));

  it('says an unused guest account is deleted after 90 days', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent.replace(/\s+/g, ' ');

    expect(text).toContain('Keep your progress');
    expect(text).toContain('If you do not open the game for 90 days');
  });

  it('signs the guest in with Google', async () => {
    const fixture = await render();
    const signIn = jest.spyOn(account, 'signIn');

    buttons(fixture.nativeElement)[0].click();

    expect(signIn).toHaveBeenCalled();
  });

  it('puts itself away on "Later"', async () => {
    const fixture = await render();
    const dismiss = jest.spyOn(TestBed.inject(GuestNotice), 'dismiss');
    const later = buttons(fixture.nativeElement)[1];

    expect(later.textContent?.trim()).toBe('Later');
    later.click();

    expect(dismiss).toHaveBeenCalled();
  });
});
