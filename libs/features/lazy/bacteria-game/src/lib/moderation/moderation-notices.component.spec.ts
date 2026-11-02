import { TestBed } from '@angular/core/testing';
import { FakeGameModeration } from '../../testing/fake-game-moderation';
import { I18nService } from '../i18n/i18n.service';
import { GameCloud } from '../storage/game-cloud';
import { ModerationNoticesComponent } from './moderation-notices.component';

describe('ModerationNoticesComponent', () => {
  let moderation: FakeGameModeration;

  beforeEach(() => {
    TestBed.resetTestingModule();
    moderation = new FakeGameModeration();
    TestBed.configureTestingModule({
      providers: [
        { provide: GameCloud, useValue: { moderation: () => moderation } },
      ],
    });
    TestBed.inject(I18nService).setLanguage('en');
  });

  function render() {
    const fixture = TestBed.createComponent(ModerationNoticesComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    return {
      fixture,
      host,
      text: () => host.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    };
  }

  it('shows nothing while no ban holds and nothing is told', () => {
    expect(render().text()).toBe('');
  });

  it('tells until when and why a ban holds, and what it takes away', () => {
    moderation.banFor(Date.UTC(2026, 10, 2, 15, 30), 'offensive-profile');
    const { text } = render();

    expect(text()).toContain('Your account is suspended until');
    expect(text()).toContain('2026');
    expect(text()).toContain('Reason: an offensive profile.');
    expect(text()).toContain('not online');
  });

  it('tells a permanent ban as such', () => {
    moderation.banFor(null, 'cheating');

    expect(render().text()).toContain(
      'Your account is suspended. Reason: cheating.'
    );
  });

  it('lists the notices, each dismissed on its own', async () => {
    moderation.notify({ id: 'n1', type: 'profile-reset', at: 1 });
    moderation.notify({
      id: 'n2',
      type: 'banned',
      at: 2,
      until: null,
      reason: 'spam',
    });
    const { fixture, host, text } = render();

    expect(text()).toContain('Your profile was reset');
    expect(text()).toContain('Your account was suspended. Reason: spam.');
    host.querySelector<HTMLButtonElement>('li button')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(moderation.dismissed).toEqual(['n1']);
    expect(text()).not.toContain('Your profile was reset');
  });

  it('speaks German', () => {
    TestBed.inject(I18nService).setLanguage('de');
    moderation.banFor(null, 'spam');

    expect(render().text()).toContain('Dein Konto ist gesperrt. Grund: Spam.');
  });
});
