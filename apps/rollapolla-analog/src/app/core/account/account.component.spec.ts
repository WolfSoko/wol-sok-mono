import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AccountAdapterMock } from '../../adapter/account-adapter-mock.service';
import { AccountPort, SignInCancelled } from '../../ports/account.port';
import { AccountComponent } from './account.component';

describe('AccountComponent', () => {
  let fixture: ComponentFixture<AccountComponent>;
  let account: AccountAdapterMock;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountComponent],
      providers: [{ provide: AccountPort, useClass: AccountAdapterMock }],
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

  it('signs in with Google and shows the name', async () => {
    query('sign-in-button').nativeElement.click();
    await fixture.whenStable();

    expect(query('account-name').nativeElement.textContent).toContain(
      'Ada Lovelace'
    );
    expect(query('sign-in-button')).toBeNull();
  });

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
