import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { AccountAdapterMock } from '../../adapter/account-adapter-mock.service';
import { AdminAdapterMock } from '../../adapter/admin-adapter-mock.service';
import { AppConfigAdapterMock } from '../../adapter/app-config-adapter-mock.service';
import { AccountPort } from '../../ports/account.port';
import { AdminPort } from '../../ports/admin.port';
import { AppConfigPort } from '../../ports/app-config.port';
import { Poll } from '../../../shared/poll';
import { AdminFeaturesComponent } from './admin-features.component';
import { AdminMessagesComponent } from './admin-messages.component';
import { AdminPollsComponent } from './admin-polls.component';
import { AdminUsersComponent } from './admin-users.component';

describe('admin tabs', () => {
  let admin: AdminAdapterMock;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: AccountPort, useClass: AccountAdapterMock },
        { provide: AdminPort, useClass: AdminAdapterMock },
        { provide: AppConfigPort, useClass: AppConfigAdapterMock },
      ],
    });
    admin = TestBed.inject(AdminPort) as AdminAdapterMock;
  });

  afterEach(() => {
    document.querySelector('.cdk-overlay-container')?.remove();
  });

  async function render<T>(component: Type<T>): Promise<ComponentFixture<T>> {
    const fixture = TestBed.createComponent(component);
    await fixture.whenStable();
    return fixture;
  }

  function all<T>(fixture: ComponentFixture<T>, testId: string) {
    return fixture.debugElement.queryAll(By.css(`[data-testid="${testId}"]`));
  }

  /** Clicks a button, then confirms (or cancels) the dialog it opens. */
  async function clickAndAnswer<T>(
    fixture: ComponentFixture<T>,
    click: () => void,
    confirm: boolean
  ): Promise<void> {
    click();
    await fixture.whenStable();
    const buttons = document.querySelectorAll<HTMLButtonElement>(
      'rap-confirm-dialog button'
    );
    expect(buttons).toHaveLength(2);
    buttons[confirm ? 1 : 0].click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  function poll(id: string, question: string): Poll {
    return {
      id,
      question,
      options: ['a', 'b'],
      counts: [0, 0],
      totalVotes: 0,
      createdAt: new Date(),
      closesAt: new Date(Date.now() + 3600_000),
      creatorUid: 'someone',
      listed: false,
      round: 0,
    };
  }

  describe('polls', () => {
    it('lists unlisted polls too and deletes one after confirming', async () => {
      admin.polls$.next([poll('p1', 'Keep me?'), poll('p2', 'Spam?')]);
      const fixture = await render(AdminPollsComponent);
      expect(fixture.nativeElement.textContent).toContain('unlisted');

      await clickAndAnswer(
        fixture,
        () => all(fixture, 'admin-delete-poll')[1].nativeElement.click(),
        true
      );

      expect(admin.polls$.value.map(({ id }) => id)).toEqual(['p1']);
      expect(fixture.nativeElement.textContent).not.toContain('Spam?');
    });

    it('keeps the poll when the admin cancels', async () => {
      admin.polls$.next([poll('p1', 'Keep me?')]);
      const fixture = await render(AdminPollsComponent);

      await clickAndAnswer(
        fixture,
        () => all(fixture, 'admin-delete-poll')[0].nativeElement.click(),
        false
      );

      expect(admin.polls$.value).toHaveLength(1);
    });
  });

  describe('messages', () => {
    it('shows where a message was posted and deletes it', async () => {
      admin.messages$.next([
        {
          id: 'm1',
          message: 'Hello lobby!',
          createdAt: new Date(),
          authorName: 'Ada',
          pollId: null,
        },
        {
          id: 'm1',
          message: 'Spam in a poll',
          createdAt: new Date(),
          authorName: null,
          pollId: 'p1',
        },
      ]);
      const fixture = await render(AdminMessagesComponent);
      const messages = all(fixture, 'admin-message');
      expect(messages[0].nativeElement.textContent).toContain('live chat');
      expect(
        messages[1].query(By.css('a')).nativeElement.getAttribute('href')
      ).toBe('/poll/p1');

      await clickAndAnswer(
        fixture,
        () => all(fixture, 'admin-delete-message')[1].nativeElement.click(),
        true
      );

      expect(admin.messages$.value.map(({ message }) => message)).toEqual([
        'Hello lobby!',
      ]);
    });
  });

  describe('users', () => {
    const user = (uid: string, isAdmin: boolean) => ({
      uid,
      displayName: uid,
      email: `${uid}@example.com`,
      photoUrl: null,
      createdAt: new Date(),
      lastSignInAt: new Date(),
      isAdmin,
    });

    it('grants admin rights after confirming, but never touches your own', async () => {
      await (
        TestBed.inject(AccountPort) as AccountAdapterMock
      ).signInWithGoogle();
      admin.users$.next([user('mock-user', true), user('grace', false)]);
      const fixture = await render(AdminUsersComponent);
      const toggles = () =>
        all(fixture, 'admin-toggle').map((toggle) =>
          toggle.nativeElement.querySelector('button')
        );
      expect(toggles()[0].disabled).toBe(true);

      await clickAndAnswer(fixture, () => toggles()[1].click(), true);

      expect(admin.users$.value[1].isAdmin).toBe(true);
      expect(toggles()[1].getAttribute('aria-checked')).toBe('true');
    });

    it('loads the next page of users on demand', async () => {
      admin.usersPageSize = 1;
      admin.users$.next([user('ada', false), user('grace', false)]);
      const fixture = await render(AdminUsersComponent);
      expect(all(fixture, 'admin-toggle')).toHaveLength(1);

      all(fixture, 'admin-users-more')[0].nativeElement.click();
      await fixture.whenStable();

      expect(all(fixture, 'admin-toggle')).toHaveLength(2);
      expect(all(fixture, 'admin-users-more')).toHaveLength(0);
    });

    it('flips the toggle back when the server refuses', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      admin.users$.next([user('grace', false)]);
      admin.failWrites = true;
      const fixture = await render(AdminUsersComponent);
      const toggle = () =>
        all(fixture, 'admin-toggle')[0].nativeElement.querySelector('button');

      await clickAndAnswer(fixture, () => toggle().click(), true);

      expect(toggle().getAttribute('aria-checked')).toBe('false');
    });

    it('flips the toggle back when the admin cancels', async () => {
      admin.users$.next([user('grace', false)]);
      const fixture = await render(AdminUsersComponent);
      const toggle = () =>
        all(fixture, 'admin-toggle')[0].nativeElement.querySelector('button');

      await clickAndAnswer(fixture, () => toggle().click(), false);

      expect(admin.users$.value[0].isAdmin).toBe(false);
      expect(toggle().getAttribute('aria-checked')).toBe('false');
    });
  });

  describe('features', () => {
    it('shows the current toggles and switches one', async () => {
      const config = TestBed.inject(AppConfigPort) as AppConfigAdapterMock;
      config.features.update((features) => ({ ...features, pollChat: false }));
      const fixture = await render(AdminFeaturesComponent);
      const toggle = (flag: string) =>
        all(fixture, `feature-${flag}`)[0].nativeElement.querySelector(
          'button'
        );
      expect(toggle('pollChat').getAttribute('aria-checked')).toBe('false');

      toggle('lobbyChat').click();
      await fixture.whenStable();

      expect(admin.features).toEqual({ lobbyChat: false });
    });

    it('flips the toggle back when the backend refuses', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      admin.failWrites = true;
      const fixture = await render(AdminFeaturesComponent);
      const toggle = () =>
        all(fixture, 'feature-pollCreation')[0].nativeElement.querySelector(
          'button'
        );

      toggle().click();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();

      expect(toggle().getAttribute('aria-checked')).toBe('true');
    });
  });
});
