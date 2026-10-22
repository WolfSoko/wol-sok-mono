import { TestBed } from '@angular/core/testing';
import { AccountComponent } from './account.component';
import { GameAccount, SignInOutcome } from '../storage/game-account';
import { GameStorage } from '../storage/game-storage';
import { FakeGameAccount } from '../../testing/fake-game-account';

describe('AccountComponent', () => {
  let account: FakeGameAccount;

  beforeEach(() => {
    TestBed.resetTestingModule();
    account = new FakeGameAccount();
  });

  async function render(
    provided: GameAccount | null = account,
    { loaded = true } = {}
  ) {
    TestBed.configureTestingModule({
      providers:
        provided === null
          ? []
          : [
              { provide: GameAccount, useValue: provided },
              { provide: GameStorage, useValue: account.storage },
            ],
    });
    const fixture = TestBed.createComponent(AccountComponent);
    if (loaded) {
      account.flush();
    }
    await fixture.whenStable();
    return fixture;
  }

  const text = (element: HTMLElement) =>
    element.textContent?.replace(/\s+/g, ' ').trim();

  it('says the progress stays on this device without the cloud', async () => {
    const fixture = await render(null);

    expect(text(fixture.nativeElement)).toBe('Kept on this device');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('offers a guest to sign in with Google', async () => {
    account.profile.set({ guest: true, name: null });
    const signIn = jest.spyOn(account, 'signIn');
    const fixture = await render();

    expect(text(fixture.nativeElement)).toContain('Playing as a guest');
    fixture.nativeElement.querySelector('button').click();

    expect(signIn).toHaveBeenCalled();
  });

  it("offers the sign-in only once the guest's progress is here", async () => {
    account.profile.set({ guest: true, name: null });
    const fixture = await render(account, { loaded: false });
    const button = () => fixture.nativeElement.querySelector('button');
    expect(button().disabled).toBe(true);

    account.flush();
    await fixture.whenStable();

    expect(button().disabled).toBe(false);
  });

  it('names who is signed in and offers to sign out', async () => {
    account.profile.set({ guest: false, name: 'Ada' });
    const signOut = jest.spyOn(account, 'signOut');
    const fixture = await render();

    expect(text(fixture.nativeElement)).toContain('Signed in as Ada');
    fixture.nativeElement.querySelector('button').click();

    expect(signOut).toHaveBeenCalled();
  });

  it('tells when signing out failed, and lets the player try again', async () => {
    account.profile.set({ guest: false, name: 'Ada' });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(account, 'signOut').mockRejectedValue(new Error('offline'));
    const fixture = await render();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(text(fixture.nativeElement)).toContain('That did not work');
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(false);
  });

  it('tells when the sign-in failed', async () => {
    account.profile.set({ guest: true, name: null });
    jest
      .spyOn(account, 'signIn')
      .mockResolvedValue('failed' satisfies SignInOutcome);
    const fixture = await render();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(text(fixture.nativeElement)).toContain('That did not work');
  });
});
