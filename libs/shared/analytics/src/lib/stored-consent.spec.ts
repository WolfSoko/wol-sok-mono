import { ConsentChoice } from './consent';
import { deleteCookies } from './consent-storage';
import { StoredConsent } from './stored-consent';

describe('StoredConsent', () => {
  const KEY = 'test-consent';
  let applied: ConsentChoice[];

  beforeEach(() => {
    localStorage.clear();
    applied = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function create(): StoredConsent {
    return new StoredConsent(KEY, (choice) => applied.push(choice));
  }

  it('asks while no choice is stored, and applies nothing', () => {
    const consent = create();

    consent.restore();

    expect(consent.asking()).toBe(true);
    expect(consent.choice()).toBeNull();
    expect(applied).toEqual([]);
  });

  it('applies the choice of an earlier visit without asking', () => {
    localStorage.setItem(KEY, 'granted');
    const consent = create();

    consent.restore();

    expect(consent.asking()).toBe(false);
    expect(consent.choice()).toBe('granted');
    expect(applied).toEqual(['granted']);
  });

  it('keeps and applies each choice', () => {
    const consent = create();
    consent.restore();

    consent.decide('denied');
    consent.ask();
    consent.decide('granted');

    expect(consent.asking()).toBe(false);
    expect(applied).toEqual(['denied', 'granted']);
    expect(localStorage.getItem(KEY)).toBe('granted');
  });

  it.each(['SecurityError', 'QuotaExceededError'])(
    'applies a choice the storage refuses for the visit (%s)',
    (name) => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('refused', name);
      });
      const consent = create();
      consent.restore();

      consent.decide('granted');

      expect(consent.asking()).toBe(false);
      expect(applied).toEqual(['granted']);
    }
  );

  it('asks where reading the storage is blocked', () => {
    localStorage.setItem(KEY, 'granted');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const consent = create();

    consent.restore();

    expect(consent.asking()).toBe(true);
  });

  it('ignores a stored value it does not know', () => {
    localStorage.setItem(KEY, 'maybe');
    const consent = create();

    consent.restore();

    expect(consent.asking()).toBe(true);
  });
});

describe('deleteCookies', () => {
  afterEach(() => {
    document.cookie = 'kept=; max-age=0; path=/';
  });

  it('removes only the cookies it is asked to', () => {
    document.cookie = '__gads=ID; path=/';
    document.cookie = 'kept=yes; path=/';

    deleteCookies((name) => name === '__gads');

    expect(document.cookie).toBe('kept=yes');
  });
});
