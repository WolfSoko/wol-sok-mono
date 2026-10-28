import { TestBed } from '@angular/core/testing';
import { FakeGameAccount } from '../../testing/fake-game-account';
import { LateGameStorage } from '../../testing/late-game-storage';
import { GameAccount, PlayerProfile } from '../storage/game-account';
import { DeviceStorage, GameStorage } from '../storage/game-storage';
import { GuestSignInComponent } from './guest-sign-in.component';

describe('GuestSignInComponent', () => {
  let account: FakeGameAccount;

  async function render(profile: PlayerProfile) {
    TestBed.resetTestingModule();
    account = new FakeGameAccount();
    account.profile.set(profile);
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAccount, useValue: account },
        { provide: GameStorage, useValue: account.storage },
        { provide: DeviceStorage, useValue: new LateGameStorage() },
      ],
    });
    const fixture = TestBed.createComponent(GuestSignInComponent);
    fixture.componentRef.setInput('note', 'profile.guest.friends');
    account.flush();
    await fixture.whenStable();
    return fixture;
  }

  it('tells a guest why to sign in, and signs them in', async () => {
    const fixture = await render({ guest: true, name: null });
    const signIn = jest.spyOn(account, 'signIn');
    const element: HTMLElement = fixture.nativeElement;

    expect(element.hidden).toBe(false);
    expect(element.textContent).toContain(
      'Your friends belong to your guest account.'
    );
    element.querySelector('button')?.click();

    expect(signIn).toHaveBeenCalled();
  });

  it('shows nothing to a signed-in player', async () => {
    const fixture = await render({ guest: false, name: 'Ada' });
    const element: HTMLElement = fixture.nativeElement;

    expect(element.hidden).toBe(true);
    expect(element.querySelector('button')).toBeNull();
  });
});
