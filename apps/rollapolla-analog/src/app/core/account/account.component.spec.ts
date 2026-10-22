import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AccountAdapterMock } from '../../adapter/account-adapter-mock.service';
import { AdminAdapterMock } from '../../adapter/admin-adapter-mock.service';
import { AccountPort, SignInCancelled } from '../../ports/account.port';
import { AdminPort } from '../../ports/admin.port';
import { AccountComponent } from './account.component';

describe('AccountComponent', () => {
  let fixture: ComponentFixture<AccountComponent>;
  let account: AccountAdapterMock;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountComponent],
      providers: [
        provideRouter([]),
        { provide: AccountPort, useClass: AccountAdapterMock },
        { provide: AdminPort, useClass: AdminAdapterMock },
      ],
    }).compileComponents();
    account = TestBed.inject(AccountPort) as AccountAdapterMock;
    fixture = TestBed.createComponent(AccountComponent);
    await fixture.whenStable();
  });

  it('offers Google sign-in when nobody is signed in', () => {
    expect(query('sign-in-button')).not.toBeNull();
    expect(query('account-signed-in')).toBeNull();
  });

  it('still offers Google sign-in to an anonymous visitor', async () => {
    account.accountSubject.next({
      uid: 'anon',
      isAnonymous: true,
      displayName: null,
      photoUrl: null,
    });
    await fixture.whenStable();

    expect(query('sign-in-button')).not.toBeNull();
  });

  it('links to "My polls" once there is an account, anonymous too', async () => {
    expect(query('my-polls-link')).toBeNull();

    account.accountSubject.next({
      uid: 'anon',
      isAnonymous: true,
      displayName: null,
      photoUrl: null,
    });
    await fixture.whenStable();

    expect(query('my-polls-link').nativeElement.getAttribute('href')).toBe(
      '/my-polls'
    );
  });

  it(
    'signs in with Google and shows the name',
    async () => {
      query('sign-in-button').nativeElement.click();
      await fixture.whenStable();

      expect(query('account-name').nativeElement.textContent).toContain(
        'Ada Lovelace'
      );
      expect(query('sign-in-button')).toBeNull();
    },
    // Zoneless CD normally flushes this click's signal writes on a microtask,
    // but once the scheduler's brief post-tick microtask window has closed it
    // falls back to a requestAnimationFrame-raced callback in Angular's
    // internal zoneless change-detection scheduler (@angular/core); under a
    // loaded CI runner that can occasionally outlast the 5s default test
    // timeout even though the app settles fine.
    10000
  );

  it('signs out', async () => {
    query('sign-in-button').nativeElement.click();
    await fixture.whenStable();
    query('sign-out-button').nativeElement.click();
    await fixture.whenStable();

    expect(query('sign-in-button')).not.toBeNull();
  });

  it('stays quiet when the visitor closes the popup', async () => {
    vi.spyOn(account, 'signInWithGoogle').mockRejectedValueOnce(
      new SignInCancelled()
    );
    query('sign-in-button').nativeElement.click();
    await fixture.whenStable();

    expect(query('account-error')).toBeNull();
    expect(query('sign-in-button').nativeElement.disabled).toBe(false);
  });

  it('shows an error when signing in fails', async () => {
    vi.spyOn(account, 'signInWithGoogle').mockRejectedValueOnce(
      new Error('auth/unauthorized-domain')
    );
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    query('sign-in-button').nativeElement.click();
    await fixture.whenStable();

    expect(query('account-error')).not.toBeNull();
  });

  function query(testId: string) {
    return fixture.debugElement.query(By.css(`[data-testid="${testId}"]`));
  }
});
