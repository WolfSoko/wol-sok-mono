import { TestBed } from '@angular/core/testing';
import { FakeGameAccount } from '../../testing/fake-game-account';
import {
  FakeGamePresence,
  FakeGameSocial,
} from '../../testing/fake-game-social';
import { I18nService } from '../i18n/i18n.service';
import { GameAccount } from '../storage/game-account';
import { GameCloud } from '../storage/game-cloud';
import { defaultProfile } from './profile';
import { ProfileEditorComponent } from './profile-editor.component';

describe('ProfileEditorComponent', () => {
  let social: FakeGameSocial;
  let account: FakeGameAccount;

  let fixture: ReturnType<
    typeof TestBed.createComponent<ProfileEditorComponent>
  >;

  async function render(): Promise<HTMLElement> {
    fixture = TestBed.createComponent(ProfileEditorComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    social = new FakeGameSocial();
    account = new FakeGameAccount('ada');
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAccount, useValue: account },
        {
          provide: GameCloud,
          useValue: {
            social: () => social,
            presence: () => new FakeGamePresence(),
            rooms: () => null,
          },
        },
      ],
    });
  });

  it('saves the name, the motto and the picture picked', async () => {
    account.profile.set({
      guest: false,
      name: 'Ada',
      photoUrl: 'https://lh3.googleusercontent.com/a/ada',
    });
    const host = await render();
    const [name, motto] = Array.from(
      host.querySelectorAll('input[matInput]')
    ) as HTMLInputElement[];

    name.value = '  Ada  L ';
    name.dispatchEvent(new Event('input'));
    motto.value = 'Divide and conquer';
    motto.dispatchEvent(new Event('input'));
    (
      host.querySelector('[aria-label="Google photo"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    (
      Array.from(host.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Save')
      ) as HTMLButtonElement
    ).click();
    await new Promise((resolve) => setTimeout(resolve));

    expect(social.get('profiles/ada')).toEqual({
      name: 'Ada L',
      motto: 'Divide and conquer',
      avatar: { kind: 'photo', url: 'https://lh3.googleusercontent.com/a/ada' },
      shareStatus: true,
      publicName: false,
      boardOptOut: false,
      galleryOptOut: false,
    });
  });

  it('saves the public name and the opt-outs, off at first', async () => {
    account.profile.set({ guest: true, name: null });
    const host = await render();
    const toggle = (label: string) => {
      const found = Array.from(host.querySelectorAll('mat-slide-toggle')).find(
        (each) => each.textContent?.includes(label)
      );
      if (found === undefined) {
        throw new Error(`no toggle "${label}"`);
      }
      return found.querySelector('button') as HTMLButtonElement;
    };

    expect(toggle('Show my name in public').getAttribute('aria-checked')).toBe(
      'false'
    );
    expect(host.textContent).toContain('Anonymous #1234');
    expect(host.textContent).toContain('Your results still count');

    toggle('Show my name in public').click();
    toggle('Keep me off the leaderboards').click();
    toggle('Keep my matches out of the public gallery').click();
    fixture.detectChanges();
    (
      Array.from(host.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Save')
      ) as HTMLButtonElement
    ).click();
    await new Promise((resolve) => setTimeout(resolve));

    expect(social.get('profiles/ada')).toMatchObject({
      publicName: true,
      boardOptOut: true,
      galleryOptOut: true,
    });
  });

  it('waits for the stored profile before it lets the switches or a save', async () => {
    account.profile.set({ guest: true, name: null });
    social.put('profiles/ada', {
      ...defaultProfile('ada'),
      name: 'Ada',
      boardOptOut: true,
    });
    social.profilesAnswer.next(false);
    const host = await render();
    const save = () =>
      Array.from(host.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Save')
      ) as HTMLButtonElement;
    const switches = () =>
      Array.from(
        host.querySelectorAll('mat-slide-toggle button')
      ) as HTMLButtonElement[];
    const name = host.querySelector('input[matInput]') as HTMLInputElement;
    name.value = 'Ada L';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(save().disabled).toBe(true);
    expect(switches().every((each) => each.disabled)).toBe(true);

    social.profilesAnswer.next(true);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(save().disabled).toBe(false);
    expect(switches().some((each) => each.disabled)).toBe(false);
    // The stored opt-out shows, though the name was typed meanwhile.
    expect(
      switches()
        .find((each) =>
          each
            .closest('mat-slide-toggle')
            ?.textContent?.includes('Keep me off the leaderboards')
        )
        ?.getAttribute('aria-checked')
    ).toBe('true');
  });

  it('saves only what the player changed', async () => {
    account.profile.set({ guest: true, name: null });
    social.put('profiles/ada', {
      ...defaultProfile('ada'),
      name: 'Ada',
      boardOptOut: true,
    });
    const saved = jest.spyOn(social, 'saveProfile');
    const host = await render();
    const motto = host.querySelectorAll(
      'input[matInput]'
    )[1] as HTMLInputElement;

    motto.value = ' Divide ';
    motto.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (
      Array.from(host.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Save')
      ) as HTMLButtonElement
    ).click();
    await new Promise((resolve) => setTimeout(resolve));

    expect(saved).toHaveBeenCalledWith('ada', { motto: 'Divide' });
    expect(social.get('profiles/ada')).toMatchObject({
      name: 'Ada',
      motto: 'Divide',
      boardOptOut: true,
    });
  });

  it('offers the drawn bacteria, no Google photo to a guest', async () => {
    account.profile.set({ guest: true, name: null });
    const host = await render();

    expect(host.querySelectorAll('.picture[role="radio"]')).toHaveLength(12);
    expect(host.querySelector('[aria-label="Google photo"]')).toBeNull();
    expect(host.textContent).toContain("Friends see when I'm online");
  });

  it('speaks German', async () => {
    account.profile.set({ guest: true, name: null });
    TestBed.inject(I18nService).setLanguage('de');
    const host = await render();

    expect(host.textContent).toContain('Freunde sehen, wenn ich online bin');
    expect(host.textContent).toContain('Meinen Namen öffentlich zeigen');
    expect(host.textContent).toContain(
      'Mich aus den Bestenlisten heraushalten'
    );
    expect(host.querySelector('[aria-label="Bakterium 1"]')).not.toBeNull();
  });
});
