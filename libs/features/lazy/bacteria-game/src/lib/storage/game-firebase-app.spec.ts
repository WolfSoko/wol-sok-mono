import type { FirebaseApp } from 'firebase/app';
import { gameFirebaseApp } from './game-firebase-app';

describe('gameFirebaseApp', () => {
  const options = { projectId: 'bacteria-wars' };

  it("takes the game's app when it is started already", () => {
    const started = { name: 'bacteria-wars' } as FirebaseApp;
    const initializeApp = jest.fn();

    const app = gameFirebaseApp(
      {
        getApps: () => [{ name: '[DEFAULT]' } as FirebaseApp, started],
        initializeApp,
      },
      options
    );

    expect(app).toBe(started);
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it('starts it under its own name otherwise', () => {
    const started = { name: 'bacteria-wars' } as FirebaseApp;
    const initializeApp = jest.fn(() => started);

    expect(gameFirebaseApp({ getApps: () => [], initializeApp }, options)).toBe(
      started
    );
    expect(initializeApp).toHaveBeenCalledWith(options, 'bacteria-wars');
  });
});
