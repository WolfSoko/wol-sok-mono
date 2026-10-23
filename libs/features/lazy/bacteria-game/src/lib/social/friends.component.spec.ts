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
import { FriendsComponent } from './friends.component';

describe('FriendsComponent', () => {
  let social: FakeGameSocial;
  let presence: FakeGamePresence;

  beforeEach(() => {
    TestBed.resetTestingModule();
    social = new FakeGameSocial();
    presence = new FakeGamePresence();
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAccount, useValue: new FakeGameAccount('ada') },
        {
          provide: GameCloud,
          useValue: {
            social: () => social,
            presence: () => presence,
            rooms: () => null,
          },
        },
      ],
    });
  });

  it('lists requests to answer and friends to challenge while online', async () => {
    await social.saveProfile('bob', {
      ...defaultProfile('bob'),
      name: 'Bob',
      motto: 'Hi',
    });
    await social.saveProfile('cyd', { ...defaultProfile('cyd'), name: 'Cyd' });
    await social.sendRequest('ada', 'bob');
    await social.acceptRequest('bob', 'ada');
    await social.sendRequest('cyd', 'ada');
    presence.set('bob', 'online');
    const fixture = TestBed.createComponent(FriendsComponent);
    const challenged = jest.fn();
    fixture.componentInstance.challenge.subscribe(challenged);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    expect(host.textContent).toContain('Cyd');
    expect(host.textContent).toContain('wants to be friends');
    expect(host.textContent).toContain('Bob');
    expect(host.textContent).toContain('Online · Hi');
    (
      Array.from(host.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Challenge')
      ) as HTMLButtonElement
    ).click();
    expect(challenged).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'bob' })
    );

    (
      Array.from(host.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Accept')
      ) as HTMLButtonElement
    ).click();
    await new Promise((resolve) => setTimeout(resolve));
    expect(social.get('players/ada/friends/cyd')).not.toBeNull();
  });

  it('speaks German', async () => {
    await social.saveProfile('bob', { ...defaultProfile('bob'), name: 'Bob' });
    await social.sendRequest('ada', 'bob');
    await social.acceptRequest('bob', 'ada');
    presence.set('bob', 'online');
    TestBed.inject(I18nService).setLanguage('de');
    const fixture = TestBed.createComponent(FriendsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    expect(host.textContent).toContain('Herausfordern');
    expect(host.textContent).toContain('Freund einladen');
  });
});
