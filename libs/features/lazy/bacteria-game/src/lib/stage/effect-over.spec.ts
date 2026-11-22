import { EMPTY, Observable, of, Subject, throwError } from 'rxjs';
import { effectOver } from './effect-over';

describe('effectOver', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => consoleError.mockRestore());

  function outcome(effect: () => Observable<unknown>): jest.Mock[] {
    const next = jest.fn();
    const complete = jest.fn();
    effectOver(effect).subscribe({ next, complete });
    return [next, complete];
  }

  it('is over once the effect completes, with one value', () => {
    const effect = new Subject<string>();
    const [next, complete] = outcome(() => effect);

    effect.next('frame');
    effect.next('frame');
    expect(complete).not.toHaveBeenCalled();
    effect.complete();

    expect(next).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalled();
  });

  it('is over for an effect that ends without a value', () => {
    const [next, complete] = outcome(() => EMPTY);

    expect(next).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalled();
  });

  it('is over for an effect that fails, logging why', () => {
    const error = new Error('lost context');
    const [, complete] = outcome(() => throwError(() => error));

    expect(complete).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      'The arena could not be vaporized',
      error
    );
  });

  it('is over for an effect that fails while it is set up', () => {
    const [, complete] = outcome(() => {
      throw new Error('no host');
    });

    expect(complete).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  it('sets the effect up only once subscribed', () => {
    const effect = jest.fn(() => of(1));

    const over = effectOver(effect);
    expect(effect).not.toHaveBeenCalled();
    over.subscribe();

    expect(effect).toHaveBeenCalledTimes(1);
  });
});
