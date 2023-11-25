import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, lastValueFrom } from 'rxjs';
import { AuthQuery } from '../akita-fire-auth';
import { AuthenticationService } from '../authentication.service';
import { loginIfNotAuthenticated } from './login-if-not-authenticated';

describe('loginIfNotAuthenticated', () => {
  let authenticated$: BehaviorSubject<boolean>;
  beforeEach(() => {
    authenticated$ = new BehaviorSubject<boolean>(true);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthenticationService,
          useValue: {
            signIn: jest.fn(() => Promise.resolve(true)),
          },
        },
        { provide: AuthQuery, useValue: { authenticated$ } },
      ],
    });
  });

  it('should return true if authenticated', async () => {
    const result = await whenLoginIfNotAuthenticatedIsCalled();
    expect(result).toBe(true);
  });

  it('should call signIn if not authenticated', async () => {
    authenticated$.next(false);
    await whenLoginIfNotAuthenticatedIsCalled();
    expect(TestBed.inject(AuthenticationService).signIn).toHaveBeenCalled();
  });

  it('should return result from signIn', async () => {
    authenticated$.next(false);
    const result = await whenLoginIfNotAuthenticatedIsCalled();
    expect(result).toBe(true);
  });

  it('should return false if signIn fails', async () => {
    authenticated$.next(false);
    TestBed.inject(AuthenticationService).signIn = jest.fn(() =>
      Promise.reject()
    );
    const result = await whenLoginIfNotAuthenticatedIsCalled();
    expect(result).toBe(false);
  });

  function whenLoginIfNotAuthenticatedIsCalled(): Promise<boolean> {
    return TestBed.runInInjectionContext(() =>
      lastValueFrom(loginIfNotAuthenticated())
    );
  }
});
