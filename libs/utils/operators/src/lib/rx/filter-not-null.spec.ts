import { TestScheduler } from 'rxjs/testing';
import { filterNotNil } from './filter-not-null.op';

const testScheduler = new TestScheduler((actual, expected) => {
  // asserting the two objects are equal - required
  // for TestScheduler assertions to work via your test framework
  // e.g. using chai.
  expect(actual).toEqual(expected);
});

describe('filterNotNull', () => {
  it('should filter null', () => {
    testScheduler.run(({ cold, expectObservable }) => {
      const values = {
        a: 1,
        b: 'test',
        c: null,
        d: undefined,
        e: {},
        f: [],
      };
      const source = cold('abcdef|', values).pipe(filterNotNil);
      const expect1 = 'ab--ef|';
      expectObservable(source).toBe(expect1, values);
    });
  });
});
