import { fitImagesForCapture, objectFitRect } from './fit-images';

describe('objectFitRect', () => {
  const box = { width: 200, height: 100 };
  const wideLogo = { width: 400, height: 100 };
  const smallLogo = { width: 40, height: 20 };

  it('should stretch the image over the box for fill', () => {
    expect(objectFitRect('fill', '50% 50%', box, wideLogo)).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    });
  });

  it('should keep the aspect ratio and center the image for contain', () => {
    expect(objectFitRect('contain', '50% 50%', box, wideLogo)).toEqual({
      x: 0,
      y: 25,
      width: 200,
      height: 50,
    });
  });

  it('should cover the box and crop the overflow evenly for cover', () => {
    expect(objectFitRect('cover', '50% 50%', box, wideLogo)).toEqual({
      x: -100,
      y: 0,
      width: 400,
      height: 100,
    });
  });

  it('should not scale a small image up for scale-down', () => {
    expect(objectFitRect('scale-down', '50% 50%', box, smallLogo)).toEqual({
      x: 80,
      y: 40,
      width: 40,
      height: 20,
    });
  });

  it('should shrink a large image like contain for scale-down', () => {
    expect(objectFitRect('scale-down', '50% 50%', box, wideLogo)).toEqual(
      objectFitRect('contain', '50% 50%', box, wideLogo)
    );
  });

  it('should keep the natural size for none', () => {
    expect(objectFitRect('none', '50% 50%', box, smallLogo)).toEqual({
      x: 80,
      y: 40,
      width: 40,
      height: 20,
    });
  });

  it('should place the image by percentages, lengths and keywords', () => {
    expect(objectFitRect('none', '0% 100%', box, smallLogo)).toMatchObject({
      x: 0,
      y: 80,
    });
    expect(objectFitRect('none', '10px 5px', box, smallLogo)).toMatchObject({
      x: 10,
      y: 5,
    });
    expect(objectFitRect('none', 'right top', box, smallLogo)).toMatchObject({
      x: 160,
      y: 0,
    });
  });
});

describe('fitImagesForCapture', () => {
  const drawImage = jest.fn();
  const canvases: HTMLCanvasElement[] = [];

  function givenImage(
    objectFit: string,
    natural = { width: 400, height: 100 }
  ): HTMLImageElement {
    const img = document.createElement('img');
    img.src = 'logo.svg';
    img.decode = jest.fn().mockResolvedValue(undefined);
    // jsdom neither loads images nor does layout
    Object.defineProperties(img, {
      naturalWidth: { value: natural.width },
      naturalHeight: { value: natural.height },
      clientWidth: { value: 220 },
      clientHeight: { value: 120 },
    });
    img.dataset['objectFit'] = objectFit;
    return img;
  }

  beforeEach(() => {
    const getComputedStyle = window.getComputedStyle.bind(window);
    jest.spyOn(window, 'getComputedStyle').mockImplementation((elem) => {
      const objectFit = (elem as HTMLElement).dataset['objectFit'];
      return objectFit == null
        ? getComputedStyle(elem)
        : ({
            objectFit,
            objectPosition: '50% 50%',
            paddingLeft: '10px',
            paddingRight: '10px',
            paddingTop: '10px',
            paddingBottom: '10px',
          } as CSSStyleDeclaration);
    });
    // jsdom has no canvas
    jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(function (this: HTMLCanvasElement) {
        canvases.push(this);
        return { drawImage };
      } as unknown as HTMLCanvasElement['getContext']);
    jest
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/png;base64,fitted');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    drawImage.mockReset();
    canvases.length = 0;
  });

  it('should draw an object-fit image the way the browser shows it into the content box', async () => {
    const elem = document.createElement('div');
    const img = givenImage('contain');
    elem.appendChild(img);

    await fitImagesForCapture(elem, 2);

    expect(drawImage).toHaveBeenCalledWith(img, 0, 50, 400, 100);
    expect([canvases[0].width, canvases[0].height]).toEqual([400, 200]);
    expect(img.src).toBe('data:image/png;base64,fitted');
  });

  it('should fit the cloned element itself when it is an image', async () => {
    const img = givenImage('scale-down');

    await fitImagesForCapture(img, 1);

    expect(img.src).toBe('data:image/png;base64,fitted');
  });

  it('should leave stretched and not loaded images as they are', async () => {
    const elem = document.createElement('div');
    const stretched = givenImage('fill');
    const notLoaded = givenImage('contain', { width: 0, height: 0 });
    elem.append(stretched, notLoaded);

    await fitImagesForCapture(elem, 1);

    expect(stretched.src).toMatch(/logo\.svg$/);
    expect(notLoaded.src).toMatch(/logo\.svg$/);
  });

  it('should replace the sources of a picture, they would win over the src', async () => {
    const picture = document.createElement('picture');
    const source = document.createElement('source');
    source.srcset = 'logo.webp';
    const img = givenImage('contain');
    picture.append(source, img);

    await fitImagesForCapture(picture, 1);

    expect(picture.querySelector('source')).toBeNull();
    expect(img.src).toBe('data:image/png;base64,fitted');
  });

  it('should not wait for an image that does not finish loading', async () => {
    jest.useFakeTimers();
    jest.spyOn(console, 'debug').mockImplementation();
    const elem = document.createElement('div');
    const img = givenImage('contain');
    img.decode = jest.fn(() => new Promise<void>(() => undefined));
    elem.appendChild(img);

    const fitted = fitImagesForCapture(elem, 1);
    await jest.advanceTimersByTimeAsync(1000);
    await fitted;

    expect(img.src).toMatch(/logo\.svg$/);
  });

  it('should leave an image from another origin as it is', async () => {
    jest.spyOn(console, 'debug').mockImplementation();
    jest
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockImplementation(() => {
        throw new DOMException('tainted', 'SecurityError');
      });
    const elem = document.createElement('div');
    const img = givenImage('contain');
    elem.appendChild(img);

    await fitImagesForCapture(elem, 1);

    expect(img.src).toMatch(/logo\.svg$/);
  });
});
