import { GpuTimer } from './gpu-timer';

/** A WebGL2 context with the timer extension, answering as told. */
function fakeGl(state: { disjoint: boolean; available: boolean; ns: number }) {
  const ext = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 };
  let queries = 0;
  return {
    QUERY_RESULT_AVAILABLE: 10,
    QUERY_RESULT: 11,
    getExtension: () => ext,
    createQuery: () => ({ id: queries++ }),
    deleteQuery: jest.fn(),
    beginQuery: jest.fn(),
    endQuery: jest.fn(),
    getParameter: (name: number) =>
      name === ext.GPU_DISJOINT_EXT ? state.disjoint : null,
    getQueryParameter: (_query: unknown, name: number) =>
      name === 10 ? state.available : state.ns,
  } as unknown as WebGL2RenderingContext;
}

describe('GpuTimer', () => {
  it('hands over each timing once the GPU has answered it, in ms', () => {
    const state = { disjoint: false, available: false, ns: 2_500_000 };
    const timer = GpuTimer.create(fakeGl(state));
    const taken: [string, number][] = [];
    timer?.begin('sim');
    timer?.end();
    timer?.begin('draw');
    timer?.end();

    timer?.poll((slot, ms) => taken.push([slot, ms]));
    expect(taken).toEqual([]);

    state.available = true;
    timer?.poll((slot, ms) => taken.push([slot, ms]));
    expect(taken).toEqual([
      ['sim', 2.5],
      ['draw', 2.5],
    ]);
  });

  it('drops every timing in flight once the GPU was disjoint', () => {
    const state = { disjoint: false, available: false, ns: 1_000_000 };
    const timer = GpuTimer.create(fakeGl(state));
    const taken: number[] = [];
    timer?.begin('draw');
    timer?.end();

    state.disjoint = true;
    timer?.poll((_slot, ms) => taken.push(ms));
    state.disjoint = false;
    state.available = true;
    timer?.poll((_slot, ms) => taken.push(ms));

    expect(taken).toEqual([]);
  });

  it('is null where the browser has no timer queries', () => {
    const gl = {
      getExtension: () => null,
    } as unknown as WebGL2RenderingContext;
    expect(GpuTimer.create(gl)).toBeNull();
  });
});
