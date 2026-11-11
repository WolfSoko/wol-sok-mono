import { watchStored } from './watch-stored';

/** A `storage` event as another tab's change fires it. */
function storageEvent(key: string | null): Event {
  return Object.assign(new Event('storage'), { key });
}

describe('watchStored', () => {
  it('calls on a change of its key and on a cleared storage', () => {
    const target = new EventTarget();
    const onChange = jest.fn();
    watchStored('k', onChange, target);

    target.dispatchEvent(storageEvent('k'));
    target.dispatchEvent(storageEvent(null));

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('ignores other keys and other events', () => {
    const target = new EventTarget();
    const onChange = jest.fn();
    watchStored('k', onChange, target);

    target.dispatchEvent(storageEvent('other'));
    target.dispatchEvent(Object.assign(new Event('message'), { key: 'k' }));
    target.dispatchEvent(new Event('storage'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('stops calling once stopped', () => {
    const target = new EventTarget();
    const onChange = jest.fn();
    const stop = watchStored('k', onChange, target);

    stop();
    target.dispatchEvent(storageEvent('k'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does nothing without a target', () => {
    const stop = watchStored('k', jest.fn(), undefined);
    expect(stop).not.toThrow();
  });
});
