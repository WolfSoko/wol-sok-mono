import { TestBed } from '@angular/core/testing';
import { VotedPollsStore } from './voted-polls.store';

const STORAGE_KEY = 'rap-voted-polls';

describe('VotedPollsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function create(): VotedPollsStore {
    return TestBed.inject(VotedPollsStore);
  }

  it('reads the votes as earlier versions stored them', () => {
    localStorage.setItem(STORAGE_KEY, '{"poll-a":1,"poll-a#2":0}');
    const store = create();

    expect(store.votedOption({ id: 'poll-a', round: 0 })).toBe(1);
    expect(store.votedOption({ id: 'poll-a', round: 2 })).toBe(0);
    expect(store.votedOption({ id: 'poll-b', round: 0 })).toBeUndefined();
  });

  it('stores a vote in the same form, and forgets it', () => {
    const store = create();

    store.rememberVote({ id: 'poll-a', round: 1 }, 2);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')).toEqual({
      'poll-a#1': 2,
    });

    store.forgetVote({ id: 'poll-a', round: 1 });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')).toEqual({});
  });

  it.each(['SecurityError', 'QuotaExceededError'])(
    'keeps a vote in memory where the storage refuses it (%s)',
    (name) => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('refused', name);
      });
      const store = create();

      store.rememberVote({ id: 'poll-a', round: 0 }, 1);

      expect(store.votedOption({ id: 'poll-a', round: 0 })).toBe(1);
    }
  );

  it('starts without votes where reading the storage is blocked', () => {
    localStorage.setItem(STORAGE_KEY, '{"poll-a":1}');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    expect(create().votedOption({ id: 'poll-a', round: 0 })).toBeUndefined();
  });
});
