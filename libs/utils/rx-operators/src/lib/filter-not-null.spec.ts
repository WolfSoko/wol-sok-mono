import {TestScheduler} from 'rxjs/testing';
import {filterNotNull} from './filter-not-null';

const testScheduler = new TestScheduler((actual, expected) => {
  // asserting the two objects are equal - required
  // for TestScheduler assertions to work via your test framework
  // e.g. using chai.
  expect(actual).toEqual(expected);
});

describe('filterNotNull', () => {
  it('should filter null', () => {
    testScheduler.run(({ cold, expectObservable }) => {
      const values: {
        a: number;
        b: string;
        c: null;
        d: undefined;
        e: {};
        f: any[];
      } = {
        a: 1,
        b: 'test',
        c: null,
        d: undefined,
        e: {},
        f: [],
      };
      const source = cold('abcdef|', values).pipe(filterNotNull);
      const expect1 = 'ab--ef|';
      expectObservable(source).toBe(expect1, values);
    });
  });
});
