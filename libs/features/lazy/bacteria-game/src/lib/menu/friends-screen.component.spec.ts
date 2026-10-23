import { TestBed } from '@angular/core/testing';
import { FakeGameAccount } from '../../testing/fake-game-account';
import {
  FakeGamePresence,
  FakeGameSocial,
} from '../../testing/fake-game-social';
import { defaultProfile } from '../social/profile';
import { FriendView } from '../social/social.service';
import { GameAccount } from '../storage/game-account';
import { GameCloud } from '../storage/game-cloud';
import { FriendsScreenComponent } from './friends-screen.component';

describe('FriendsScreenComponent', () => {
  let social: FakeGameSocial;
  let presence: FakeGamePresence;

  function configure(withCloud: boolean): void {
    TestBed.resetTestingModule();
    social = new FakeGameSocial();
    presence = new FakeGamePresence();
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAccount, useValue: new FakeGameAccount('ada') },
        {
          provide: GameCloud,
          useValue: {
            social: () => (withCloud ? social : null),
            presence: () => (withCloud ? presence : null),
            rooms: () => null,
          },
        },
      ],
    });
  }

  async function friendOnline(): Promise<void> {
    await social.saveProfile('bob', { ...defaultProfile('bob'), name: 'Bob' });
    await social.sendRequest('ada', 'bob');
    await social.acceptRequest('bob', 'ada');
    presence.set('bob', 'online');
  }

  function challengeButton(host: HTMLElement): HTMLButtonElement | undefined {
    return Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Challenge')
    );
  }

  it('lists the friends and reports a challenge and the way back', async () => {
    configure(true);
    await friendOnline();
    const fixture = TestBed.createComponent(FriendsScreenComponent);
    const challenged = jest.fn<void, [FriendView]>();
    const back = jest.fn();
    fixture.componentInstance.challenge.subscribe(challenged);
    fixture.componentInstance.back.subscribe(back);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    expect(host.querySelector('h2')?.textContent).toBe('Friends');
    expect(host.textContent).toContain('Bob');
    challengeButton(host)?.click();
    host.querySelector<HTMLButtonElement>('.back')?.click();

    expect(challenged).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'bob' })
    );
    expect(back).toHaveBeenCalled();
  });

  it('allows no challenge while a lobby is under way', async () => {
    configure(true);
    await friendOnline();
    const fixture = TestBed.createComponent(FriendsScreenComponent);
    fixture.componentRef.setInput('canChallenge', false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(challengeButton(fixture.nativeElement)?.disabled).toBe(true);
  });

  it('says that friends need the cloud without it', () => {
    configure(false);
    const fixture = TestBed.createComponent(FriendsScreenComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    expect(host.textContent).toContain("Friends need the game's cloud");
    expect(host.querySelector('feat-lazy-bac-game-friends')).toBeNull();
  });
});
