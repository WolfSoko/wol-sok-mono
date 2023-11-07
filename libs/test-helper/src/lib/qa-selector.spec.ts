import { qaSelector } from './qa-selector';

describe('qaSelector', () => {
  it.each(['elementX', 'elementY'])('should add the given qaValue %s to the selector', () => {
    expect(qaSelector('testElement')).toContain('data-qa="testElement"');
  });
});
