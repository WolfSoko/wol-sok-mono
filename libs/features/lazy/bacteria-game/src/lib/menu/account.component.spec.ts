import { TestBed } from '@angular/core/testing';
import { AccountComponent } from './account.component';
import { GameAccount, SignInOutcome } from '../storage/game-account';
import { FakeGameAccount } from '../../testing/fake-game-account';

describe('AccountComponent', () => {
  let account: FakeGameAccount;

  beforeEach(() => {
    TestBed.resetTestingModule();
    account = new FakeGameAccount();
  });

  async function render(provided: GameAccount | null = account) {
    TestBed.configureTestingModule({
      providers:
        provided === null ? [] : [{ provide: GameAccount, useValue: provided }],
    });
    const fixture = TestBed.createComponent(AccountComponent);
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

  it('names who is signed in and offers to sign out', async () => {
    account.profile.set({ guest: false, name: 'Ada' });
    const signOut = jest.spyOn(account, 'signOut');
    const fixture = await render();

    expect(text(fixture.nativeElement)).toContain('Signed in as Ada');
    fixture.nativeElement.querySelector('button').click();

    expect(signOut).toHaveBeenCalled();
  });

  it('tells when the sign-in failed', async () => {
    account.profile.set({ guest: true, name: null });
    jest
      .spyOn(account, 'signIn')
      .mockResolvedValue('failed' satisfies SignInOutcome);
    const fixture = await render();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(text(fixture.nativeElement)).toContain('Sign-in failed');
  });
});
