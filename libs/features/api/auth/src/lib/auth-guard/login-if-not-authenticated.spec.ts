import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthFacade } from '../fire-auth';
import { AuthenticationService } from '../authentication.service';
import { Profile } from '../profile';
import { loginIfNotAuthenticated } from './login-if-not-authenticated';

jest.mock('../fire-auth/auth.facade', () => {
  class AuthFacade {}
  return {
    AuthFacade,
  };
});
describe('loginIfNotAuthenticated', () => {
  let authenticated: WritableSignal<boolean>;
  let authenticationServiceMock: jest.Mocked<Partial<AuthenticationService>>;
  beforeEach(() => {
    authenticated = signal<boolean>(true);
    authenticationServiceMock = {
      signIn: jest.fn().mockResolvedValue({ uid: 'foo' }),
    };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthenticationService,
          useValue: {
            ...authenticationServiceMock,
          },
        },
        { provide: AuthFacade, useValue: { authenticated } },
      ],
    });
  });

  it('should return true if authenticated', async () => {
    const result = await whenLoginIfNotAuthenticatedIsCalled();
    expect(result).toBe(true);
  });

  it('should call signIn if not authenticated', async () => {
    authenticated.set(false);
    await whenLoginIfNotAuthenticatedIsCalled();
    expect(TestBed.inject(AuthenticationService).signIn).toHaveBeenCalled();
  });

  it('should return result from signIn', async () => {
    authenticated.set(false);

    jest
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      .mocked(authenticationServiceMock.signIn!)
      .mockResolvedValue({ uid: 'bar' } as Profile);
    const result = await whenLoginIfNotAuthenticatedIsCalled();
    expect(result).toBe(true);
  });

  it('should return false if signIn fails', async () => {
    authenticated.set(false);
    TestBed.inject(AuthenticationService).signIn = jest.fn(() =>
      Promise.reject()
    );
    const result = await whenLoginIfNotAuthenticatedIsCalled();
    expect(result).toBe(false);
  });

  async function whenLoginIfNotAuthenticatedIsCalled(): Promise<boolean> {
    return await TestBed.runInInjectionContext(() => loginIfNotAuthenticated());
  }
});
