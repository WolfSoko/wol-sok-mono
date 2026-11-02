import { TestBed } from '@angular/core/testing';
import { FakeGameAccount } from '../../testing/fake-game-account';
import {
  FakeGamePresence,
  FakeGameSocial,
} from '../../testing/fake-game-social';
import { defaultProfile } from '../social/profile';
import { GameCloud } from '../storage/game-cloud';
import { GameAccount, PlayerProfile } from '../storage/game-account';
import { GameStorage } from '../storage/game-storage';
import { AccountChipComponent } from './account-chip.component';

describe('AccountChipComponent', () => {
  let account: FakeGameAccount;

  async function render(
    profile: PlayerProfile | null,
    social: FakeGameSocial | null = null
  ) {
    TestBed.resetTestingModule();
    account = new FakeGameAccount('ada');
    account.profile.set(profile);
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAccount, useValue: account },
        { provide: GameStorage, useValue: account.storage },
        ...(social === null
          ? []
          : [
              {
                provide: GameCloud,
                useValue: {
                  social: () => social,
                  presence: () => new FakeGamePresence(),
                  rooms: () => null,
                  moderation: () => null,
                },
              },
            ]),
      ],
    });
    const fixture = TestBed.createComponent(AccountChipComponent);
    account.flush();
    await fixture.whenStable();
    return fixture;
  }

  const button = (element: HTMLElement): HTMLButtonElement | null =>
    element.querySelector('button');

  it('shows nothing before the account is known', async () => {
    const fixture = await render(null);

    expect(button(fixture.nativeElement)).toBeNull();
  });

  it('offers a guest to sign in', async () => {
    const fixture = await render({ guest: true, name: null });
    const signIn = jest.spyOn(account, 'signIn');

    expect(button(fixture.nativeElement)?.textContent?.trim()).toContain(
      'Sign in'
    );
    expect(button(fixture.nativeElement)?.getAttribute('aria-label')).toBe(
      'You play as a guest: sign in with Google'
    );
    button(fixture.nativeElement)?.click();

    expect(signIn).toHaveBeenCalled();
  });

  it('opens the profile from a signed-in player', async () => {
    const fixture = await render({ guest: false, name: 'Ada' });
    const opened = jest.fn();
    fixture.componentInstance.profile.subscribe(opened);

    expect(button(fixture.nativeElement)?.getAttribute('aria-label')).toBe(
      'Your profile: Ada'
    );
    button(fixture.nativeElement)?.click();

    expect(opened).toHaveBeenCalled();
  });

  it('shows the Google photo until the profile is read', async () => {
    const fixture = await render({
      guest: false,
      name: 'Ada',
      photoUrl: 'https://lh3.googleusercontent.com/ada',
    });

    expect(
      fixture.nativeElement.querySelector('img.photo')?.getAttribute('src')
    ).toBe('https://lh3.googleusercontent.com/ada');
  });

  it("shows the profile's avatar, an uploaded image over the Google photo", async () => {
    const social = new FakeGameSocial();
    const upload = 'data:image/webp;base64,AAAA';
    await social.saveProfile('ada', {
      ...defaultProfile('ada'),
      avatar: { kind: 'image', data: upload },
    });
    const fixture = await render(
      {
        guest: false,
        name: 'Ada',
        photoUrl: 'https://lh3.googleusercontent.com/ada',
      },
      social
    );
    await fixture.whenStable();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('img.photo')).toBeNull();
    expect(
      element
        .querySelector('feat-lazy-bac-game-avatar img')
        ?.getAttribute('src')
    ).toBe(upload);
  });
});
