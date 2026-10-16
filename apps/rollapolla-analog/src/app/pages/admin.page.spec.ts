import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By, Meta, Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AccountAdapterMock } from '../adapter/account-adapter-mock.service';
import { AdminAdapterMock } from '../adapter/admin-adapter-mock.service';
import { AppConfigAdapterMock } from '../adapter/app-config-adapter-mock.service';
import { AccountPort } from '../ports/account.port';
import { AdminPort } from '../ports/admin.port';
import { AppConfigPort } from '../ports/app-config.port';
import AdminPageComponent from './admin.page';

describe('AdminPageComponent', () => {
  let account: AccountAdapterMock;
  let admin: AdminAdapterMock;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminPageComponent],
      providers: [
        provideRouter([]),
        { provide: AccountPort, useClass: AccountAdapterMock },
        { provide: AdminPort, useClass: AdminAdapterMock },
        { provide: AppConfigPort, useClass: AppConfigAdapterMock },
      ],
    });
    account = TestBed.inject(AccountPort) as AccountAdapterMock;
    admin = TestBed.inject(AdminPort) as AdminAdapterMock;
  });

  async function render() {
    const fixture = TestBed.createComponent(AdminPageComponent);
    await fixture.whenStable();
    return fixture;
  }

  function query(fixture: ComponentFixture<unknown>, testId: string) {
    return fixture.debugElement.query(By.css(`[data-testid="${testId}"]`));
  }

  it('asks visitors without a Google account to sign in', async () => {
    account.accountSubject.next({
      uid: 'anon',
      isAnonymous: true,
      displayName: null,
      photoUrl: null,
    });

    const fixture = await render();

    expect(query(fixture, 'admin-signed-out')).not.toBeNull();
    expect(query(fixture, 'admin-tabs')).toBeNull();
  });

  it('turns away Google accounts that are not admins, naming their uid', async () => {
    await account.signInWithGoogle();

    const fixture = await render();
    expect(admin.rechecks).toBe(1);

    expect(query(fixture, 'admin-denied')).not.toBeNull();
    expect(query(fixture, 'admin-own-uid').nativeElement.textContent).toBe(
      'mock-user'
    );
    expect(query(fixture, 'admin-tabs')).toBeNull();
  });

  it('lets a newly granted admin in after checking again', async () => {
    await account.signInWithGoogle();
    const fixture = await render();
    vi.spyOn(admin, 'recheckAdmin').mockImplementation(async () =>
      admin.isAdmin$.next(true)
    );

    query(fixture, 'admin-recheck').nativeElement.click();
    await fixture.whenStable();

    expect(query(fixture, 'admin-tabs')).not.toBeNull();
  });

  it('shows admins the tabs, starting with the statistics', async () => {
    await account.signInWithGoogle();
    admin.isAdmin$.next(true);
    admin.stats = { ...admin.stats, polls: 1234, votes: 9 };

    const fixture = await render();
    await fixture.whenStable();

    expect(query(fixture, 'admin-tabs')).not.toBeNull();
    expect(query(fixture, 'stat-polls').nativeElement.textContent).toContain(
      '1,234'
    );
    expect(query(fixture, 'stat-votes').nativeElement.textContent).toContain(
      '9'
    );
  });

  it('is not for search engines and restores the site tags on leaving', async () => {
    await render();
    const title = TestBed.inject(Title);
    const meta = TestBed.inject(Meta);
    expect(title.getTitle()).toBe('Admin | RollaPolla');
    expect(meta.getTag('name="robots"')?.content).toBe('noindex');

    TestBed.resetTestingModule();

    expect(title.getTitle()).toBe('Polls for everyone | RollaPolla.com');
    expect(meta.getTag('name="robots"')?.content).toBe('index, follow');
  });
});
