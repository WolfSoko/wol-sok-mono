import {
  cssColorToRgb,
  FALLBACK_DOT_COLOR,
  parseRgbFunction,
  resolveDotColor,
} from './dot-color';

describe('dot colour', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['rgb(10, 20, 30)', { r: 10, g: 20, b: 30, alpha: 1 }],
    ['rgba(10, 20, 30, 0.5)', { r: 10, g: 20, b: 30, alpha: 0.5 }],
    ['rgb(10 20 30 / 50%)', { r: 10, g: 20, b: 30, alpha: 0.5 }],
    ['rgba(0, 0, 0, 0)', { r: 0, g: 0, b: 0, alpha: 0 }],
    ['rgb(300, 20.4, 30)', { r: 255, g: 20, b: 30, alpha: 1 }],
  ])('reads %s', (text, rgb) => {
    expect(parseRgbFunction(text)).toEqual(rgb);
  });

  it('reads no other notation itself', () => {
    expect(parseRgbFunction('oklch(70% 0.1 200)')).toBeNull();
  });

  it('paints other notations into one pixel to read them', () => {
    const context = {
      fillStyle: '',
      fillRect: jest.fn(),
      getImageData: jest.fn(() => ({ data: [1, 2, 3, 51] })),
    };
    const canvas = {
      getContext: () => context,
    } as unknown as HTMLCanvasElement;
    expect(cssColorToRgb('oklch(70% 0.1 200)', () => canvas)).toEqual({
      r: 1,
      g: 2,
      b: 3,
      alpha: 0.2,
    });
    expect(context.fillStyle).toBe('oklch(70% 0.1 200)');
  });

  it('falls back to grey without a 2D context', () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    expect(cssColorToRgb('oklch(70% 0.1 200)', () => canvas)).toEqual(
      FALLBACK_DOT_COLOR
    );
  });

  it("takes the host's currentColor without a colour of its own", () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    // jsdom resolves no currentColor itself
    jest.spyOn(window, 'getComputedStyle').mockImplementation(
      (element) =>
        ({
          color:
            (element as HTMLElement).style.color.toLowerCase() ===
            'currentcolor'
              ? 'rgb(1, 2, 3)'
              : 'unresolved',
        }) as CSSStyleDeclaration
    );
    expect(
      resolveDotColor(host, undefined, () => document.createElement('canvas'))
    ).toEqual({ r: 1, g: 2, b: 3, alpha: 1 });
    host.remove();
  });

  it('resolves its own colour inside the host and leaves no probe behind', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    expect(
      resolveDotColor(host, 'rgb(9, 8, 7)', () =>
        document.createElement('canvas')
      )
    ).toEqual({ r: 9, g: 8, b: 7, alpha: 1 });
    expect(host.children).toHaveLength(0);
    host.remove();
  });
});
