import { TestBed } from '@angular/core/testing';
import { FakeOnlineMatch } from '../../testing/fake-online-match';
import { OnlineMatchService } from './online-match.service';
import { countResult, EMPTY_TALLY, RoomTally } from './room-tally';

describe('countResult', () => {
  it('counts a win for the seat that won', () => {
    expect(countResult(EMPTY_TALLY, 0)).toEqual([1, 0]);
    expect(countResult([1, 0], 1)).toEqual([1, 1]);
  });

  it('counts a draw for nobody', () => {
    expect(countResult([2, 1], null)).toEqual([2, 1]);
  });
});

describe('RoomTally', () => {
  let online: FakeOnlineMatch;
  let tally: RoomTally;

  beforeEach(() => {
    online = new FakeOnlineMatch();
    TestBed.configureTestingModule({
      providers: [{ provide: OnlineMatchService, useValue: online }],
    });
    tally = TestBed.inject(RoomTally);
  });

  it('counts the matches of the connection', () => {
    online.connect(0);
    tally.count(0);
    tally.count(1);
    tally.count(0);

    expect(tally.tally()).toEqual([2, 1]);
  });

  it('keeps the tally after the connection ended, for the last result', () => {
    online.connect(1);
    tally.count(1);
    online.events.next({ type: 'ended', reason: 'left' });

    expect(tally.tally()).toEqual([0, 1]);
  });

  it('starts at nought for a new connection', () => {
    online.connect(0);
    tally.count(0);
    online.connect(1);

    expect(tally.tally()).toEqual(EMPTY_TALLY);
  });
});
