import { webGlRenderer } from '../gl/renderer';
import { ArenaLayout, ArenaPainter } from './arena-painter';
import { CanvasArenaPainter } from './canvas-arena-painter';
import { createArenaPainter } from './create-arena-painter';
import { GlArenaPainter } from './gl/gl-arena-painter';

jest.mock('../gl/renderer', () => ({
  ...jest.requireActual('../gl/renderer'),
  webGlRenderer: jest.fn(),
}));
jest.mock('./canvas-arena-painter', () => ({
  CanvasArenaPainter: jest.fn(() => ({ kind: 'canvas' })),
}));
jest.mock('./gl/gl-arena-painter', () => ({
  GlArenaPainter: { create: jest.fn(() => ({ kind: 'webgl' })) },
}));

const LAYOUT: ArenaLayout = {
  width: 320,
  height: 180,
  scale: 3,
  detail: 3,
  unit: 1,
  softwareWebGl: false,
};

/** A canvas that gives a 2D context - jsdom gives none. */
function canvas(): HTMLCanvasElement {
  const element = document.createElement('canvas');
  jest
    .spyOn(element, 'getContext')
    .mockReturnValue({} as CanvasRenderingContext2D);
  return element;
}

function painterKind(layout: ArenaLayout): ArenaPainter['kind'] | undefined {
  return createArenaPainter(canvas(), layout)?.kind;
}

describe('createArenaPainter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should paint with WebGL2 on a GPU', () => {
    // given
    jest.mocked(webGlRenderer).mockReturnValue('Mali-G78');

    // when / then
    expect(painterKind(LAYOUT)).toBe('webgl');
  });

  it('should paint with Canvas 2D where WebGL2 renders on the CPU', () => {
    // given
    jest.mocked(webGlRenderer).mockReturnValue('Google SwiftShader');

    // when
    const kind = painterKind(LAYOUT);

    // then
    expect(kind).toBe('canvas');
    expect(GlArenaPainter.create).not.toHaveBeenCalled();
    expect(CanvasArenaPainter).toHaveBeenCalled();
  });

  it('should paint with WebGL2 on the CPU where the layout asks for it', () => {
    // given
    jest.mocked(webGlRenderer).mockReturnValue('Google SwiftShader');

    // when
    const kind = painterKind({ ...LAYOUT, softwareWebGl: true });

    // then
    expect(kind).toBe('webgl');
    expect(webGlRenderer).not.toHaveBeenCalled();
  });

  it('should size the canvas for the arena, all of it in view', () => {
    // given
    jest.mocked(webGlRenderer).mockReturnValue('Mali-G78');
    const element = canvas();

    // when
    createArenaPainter(element, LAYOUT);

    // then
    expect([element.width, element.height]).toEqual([960, 540]);
  });
});
