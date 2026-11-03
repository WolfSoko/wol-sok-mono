import { sharedQuad } from './gl-utils';

/** Just enough of a context to make a quad in, and to lose it. */
function fakeContext() {
  const live = new Set<object>();
  const gl = {
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88e4,
    FLOAT: 0x1406,
    createBuffer: jest.fn(() => ({})),
    bindBuffer: jest.fn(),
    bufferData: jest.fn(),
    createVertexArray: jest.fn(() => {
      const vao = {};
      live.add(vao);
      return vao;
    }),
    bindVertexArray: jest.fn(),
    enableVertexAttribArray: jest.fn(),
    vertexAttribPointer: jest.fn(),
    // The objects of a lost context are gone, restored or not.
    isVertexArray: (vao: object) => live.has(vao),
    deleteVertexArray: jest.fn(),
    deleteBuffer: jest.fn(),
  };
  return {
    gl: gl as unknown as WebGL2RenderingContext,
    fake: gl,
    lose: () => live.clear(),
  };
}

describe('sharedQuad', () => {
  it('makes one quad per context, for everything drawing in it', () => {
    const { gl, fake } = fakeContext();

    const first = sharedQuad(gl);
    const second = sharedQuad(gl);

    expect(second).toBe(first);
    expect(fake.createVertexArray).toHaveBeenCalledTimes(1);
    expect(fake.createBuffer).toHaveBeenCalledTimes(1);
  });

  it('gives each context a quad of its own', () => {
    const one = fakeContext();
    const other = fakeContext();

    expect(sharedQuad(one.gl)).not.toBe(sharedQuad(other.gl));
  });

  it('makes a new quad once the context was lost and restored', () => {
    const { gl, lose } = fakeContext();
    const before = sharedQuad(gl);

    lose();

    expect(sharedQuad(gl)).not.toBe(before);
  });

  it('never deletes the quad it hands out', () => {
    const { gl, fake } = fakeContext();

    sharedQuad(gl);
    sharedQuad(gl);

    expect(fake.deleteVertexArray).not.toHaveBeenCalled();
    expect(fake.deleteBuffer).not.toHaveBeenCalled();
  });
});
