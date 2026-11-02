import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { type AdminAccess, AdminAccessService } from './admin-access.service';
import { AdminGateComponent } from './admin-gate.component';

function render(start: AdminAccess, signsIn = true) {
  const access = signal<AdminAccess>(start);
  const service = {
    access,
    check: jest.fn(async () => access()),
    signIn: jest.fn(async () => {
      if (signsIn) {
        access.set('granted');
      }
      return signsIn;
    }),
    signOut: jest.fn(async () => access.set('signed-out')),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AdminAccessService, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(AdminGateComponent);
  fixture.detectChanges();
  return { fixture, service, text: () => fixture.nativeElement.textContent };
}

describe('AdminGateComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('offers a Google sign-in, then lets the guard run again', async () => {
    const { fixture, service, text } = render('signed-out');
    const navigate = jest
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);
    expect(text()).toContain('Sign in with the owner');

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(service.signIn).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/', {
      onSameUrlNavigation: 'reload',
    });
  });

  it('says so when the sign-in fails', async () => {
    const { fixture, text } = render('signed-out', false);
    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text()).toContain('Signing in did not work');
  });

  it('turns away an account without access, offering another', async () => {
    const { fixture, service, text } = render('no-access');
    expect(text()).toContain('no access');

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(service.signOut).toHaveBeenCalled();
    expect(service.signIn).toHaveBeenCalled();
  });
});
