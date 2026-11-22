import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FakeGameAccount } from '../../testing/fake-game-account';
import {
  FakeGamePresence,
  FakeGameSocial,
} from '../../testing/fake-game-social';
import { I18nService } from '../i18n/i18n.service';
import { GameAccount } from '../storage/game-account';
import { provideFakeGameCloud } from '../../testing/fake-game-cloud';
import { defaultProfile } from '@wolsok/feat-shared-bacteria-engine';
import { LabPass } from '../guest/lab-pass.service';
import { SignIn } from '../guest/sign-in.service';
import { ProfileEditorComponent } from './profile-editor.component';

describe('ProfileEditorComponent', () => {
  let social: FakeGameSocial;
  let account: FakeGameAccount;
  let signIns: ReturnType<typeof signal<number>>;

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
    signIns = signal(0);
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAccount, useValue: account },
        { provide: SignIn, useValue: { signIns } },
        provideFakeGameCloud({ social, presence: new FakeGamePresence() }),
      ],
    });
  });

  it('welcomes a player who just signed in, from the name', async () => {
    account.profile.set({ guest: false, name: 'Ada' });
    const labPass = TestBed.inject(LabPass);
    labPass.startOnboarding();
    const host = await render();

    expect(host.querySelector('.welcome')?.textContent).toContain(
      'Welcome to the lab'
    );
    expect(document.activeElement).toBe(
      host.querySelector('input[name="name"]')
    );

    // Leaving for a screen opened from the profile keeps it: the flow ends
    // it once the player leaves the profile (PlayFlow).
    fixture.destroy();
    expect(labPass.welcoming()).toBe(true);
  });

  it('keeps the welcome while editing and clears it after saving', async () => {
    account.profile.set({ guest: false, name: 'Ada' });
    TestBed.inject(LabPass).startOnboarding();
    const host = await render();
    const welcome = () => host.querySelector('.welcome')?.textContent;
    const name = host.querySelector<HTMLInputElement>('input[name="name"]')!;

    expect(welcome()).toContain('Ada');
    name.value = 'Cleo';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(welcome()).toContain('Ada');

    Array.from(host.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Save'))
      ?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(social.get('profiles/ada')).toMatchObject({ name: 'Cleo' });
    expect(host.querySelector('.welcome')).toBeNull();
  });

  it('welcomes a sign-in made on the profile itself, there and then', async () => {
    const labPass = TestBed.inject(LabPass);
    const host = await render();

    account.profile.set({ guest: false, name: 'Ada' });
    signIns.set(1);
    await fixture.whenStable();
    fixture.detectChanges();

    // The main menu, once back, has no onboarding left to open.
    expect(labPass.onboardingDue()).toBe(false);
    expect(host.querySelector('.welcome')?.textContent).toContain(
      'Welcome to the lab'
    );
    expect(document.activeElement).toBe(
      host.querySelector('input[name="name"]')
    );
  });

  it('opens on the motto when the Lab Pass asks for it', async () => {
    account.profile.set({ guest: false, name: 'Ada' });
    const labPass = TestBed.inject(LabPass);
    labPass.focusEditor('motto');
    const host = await render();

    expect(document.activeElement).toBe(
      host.querySelector('input[name="motto"]')
    );
    expect(labPass.editorFocus()).toBeNull();
  });

  it('welcomes nobody who opens the profile on their own', async () => {
    account.profile.set({ guest: false, name: 'Ada' });
    const host = await render();

    expect(host.querySelector('.welcome')).toBeNull();
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
