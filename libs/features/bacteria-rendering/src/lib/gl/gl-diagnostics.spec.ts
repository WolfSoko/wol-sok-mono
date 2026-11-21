import { checkGl, diagnose, GlDiagnostics } from './gl-diagnostics';
import { fakeGl, glConstant } from './testing/fake-gl';

describe('GlDiagnostics', () => {
  it('counts each error under the pass it showed after', () => {
    const fake = fakeGl();
    const diagnostics = new GlDiagnostics(fake.gl);
    fake.failNext(glConstant('INVALID_OPERATION'));
    diagnostics.check('floor');
    fake.failNext(glConstant('INVALID_OPERATION'));
    fake.failNext(glConstant('OUT_OF_MEMORY'));
    diagnostics.check('floor');
    diagnostics.check('colony');

    expect(diagnostics.errors()).toEqual([
      { pass: 'floor', error: 'INVALID_OPERATION', count: 2 },
      { pass: 'floor', error: 'OUT_OF_MEMORY', count: 1 },
    ]);
  });

  it('names a code it does not know by its number', () => {
    const fake = fakeGl();
    const diagnostics = new GlDiagnostics(fake.gl);
    fake.failNext(0x1234);

    diagnostics.check('sim');

    expect(diagnostics.errors()).toEqual([
      { pass: 'sim', error: '0x1234', count: 1 },
    ]);
  });

  it('stops reading errors after a few, as a lost context may never run dry', () => {
    const fake = fakeGl();
    const diagnostics = new GlDiagnostics(fake.gl);
    for (let i = 0; i < 50; i++) {
      fake.failNext(glConstant('CONTEXT_LOST_WEBGL'));
    }

    diagnostics.check('blit');

    expect(fake.callsOf('getError')).toBeLessThanOrEqual(8);
  });
});

describe('checkGl', () => {
  it('asks nothing of a context nobody diagnoses', () => {
    const fake = fakeGl();

    checkGl(fake.gl, 'sim');

    expect(fake.callsOf('getError')).toBe(0);
  });

  it('checks through the diagnostics a context was given', () => {
    const fake = fakeGl();
    const diagnostics = diagnose(fake.gl);
    fake.failNext(glConstant('INVALID_VALUE'));

    checkGl(fake.gl, 'sim');

    expect(diagnose(fake.gl)).toBe(diagnostics);
    expect(diagnostics.errors()).toEqual([
      { pass: 'sim', error: 'INVALID_VALUE', count: 1 },
    ]);
  });
});
