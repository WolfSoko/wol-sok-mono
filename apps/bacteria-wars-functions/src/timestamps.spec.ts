import { Timestamp } from 'firebase-admin/firestore';
import { timestampMillis } from './timestamps';

describe('timestampMillis', () => {
  it('reads a Firestore Timestamp in ms', () => {
    expect(timestampMillis(Timestamp.fromMillis(1_234))).toBe(1_234);
  });

  it('reads anything else as no time', () => {
    for (const value of [null, undefined, 1_234, '1234', { seconds: 1 }]) {
      expect(timestampMillis(value)).toBeNull();
    }
  });
});
