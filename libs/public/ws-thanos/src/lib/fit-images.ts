export interface Size {
  width: number;
  height: number;
}

/** where the image is drawn inside its content box, can reach outside of it for cover */
export interface FitRect extends Size {
  x: number;
  y: number;
}

/**
 * Rect the browser draws an image into for the css object-fit and object-position,
 * relative to the image's content box.
 */
export function objectFitRect(
  objectFit: string,
  objectPosition: string,
  box: Size,
  image: Size
): FitRect {
  const size = fittedSize(objectFit, box, image);
  const [x, y] = parseObjectPosition(objectPosition);
  return {
    ...size,
    x: positionOffset(x, box.width - size.width),
    y: positionOffset(y, box.height - size.height),
  };
}

function fittedSize(objectFit: string, box: Size, image: Size): Size {
  const containScale = Math.min(
    box.width / image.width,
    box.height / image.height
  );
  switch (objectFit) {
    case 'contain':
      return scaled(image, containScale);
    case 'cover':
      return scaled(
        image,
        Math.max(box.width / image.width, box.height / image.height)
      );
    case 'none':
      return image;
    case 'scale-down':
      return scaled(image, Math.min(1, containScale));
    default:
      return box;
  }
}

function scaled({ width, height }: Size, scale: number): Size {
  return { width: width * scale, height: height * scale };
}

/** the computed object-position, e.g. "50% 50%" or "10px 20%" */
function parseObjectPosition(objectPosition: string): [string, string] {
  const [x = '50%', y = '50%'] = objectPosition.trim().split(/\s+/);
  return [x, y];
}

const POSITION_KEYWORDS: Record<string, string> = {
  left: '0%',
  top: '0%',
  center: '50%',
  right: '100%',
  bottom: '100%',
};

/** a percentage places the image along the free space, a length shifts it */
function positionOffset(value: string, freeSpace: number): number {
  const position = POSITION_KEYWORDS[value] ?? value;
  const number = parseFloat(position);
  if (Number.isNaN(number)) {
    return freeSpace / 2;
  }
  return position.endsWith('%') ? (freeSpace * number) / 100 : number;
}

/**
 * html2canvas stretches every image over its content box, it ignores object-fit and
 * object-position. This draws each image of the cloned element the way the browser shows it,
 * at the capture scale, and swaps it in, so html2canvas only has to stretch an image of the box size.
 * Images that are not loaded or are from another origin stay as they are.
 */
export async function fitImagesForCapture(
  clonedElem: HTMLElement,
  scale: number
): Promise<void> {
  const images = Array.from(clonedElem.querySelectorAll('img'));
  // the clone lives in an iframe, instanceof would check another window's class
  if (clonedElem.tagName === 'IMG') {
    images.push(clonedElem as HTMLImageElement);
  }
  await Promise.all(images.map((img) => fitImage(img, scale)));
}

/** an image still loading gets this long, so a stalled request can't hold the snap back */
const DECODE_TIMEOUT_MS = 1000;

/** waits for the image to be ready to draw, throws when it fails or takes too long */
function decode(img: HTMLImageElement): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    img.decode(),
    new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error('image took too long to load')),
        DECODE_TIMEOUT_MS
      );
    }),
  ]).finally(() => clearTimeout(timeout));
}

async function fitImage(img: HTMLImageElement, scale: number): Promise<void> {
  const style = img.ownerDocument.defaultView?.getComputedStyle(img);
  if (style == null || (style.objectFit || 'fill') === 'fill') {
    return;
  }
  try {
    await decode(img);
    const image = { width: img.naturalWidth, height: img.naturalHeight };
    const box = {
      width:
        img.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight),
      height:
        img.clientHeight -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom),
    };
    if (
      !(image.width > 0 && image.height > 0 && box.width > 0 && box.height > 0)
    ) {
      return;
    }
    const canvas = img.ownerDocument.createElement('canvas');
    canvas.width = Math.max(1, Math.round(box.width * scale));
    canvas.height = Math.max(1, Math.round(box.height * scale));
    const context = canvas.getContext('2d');
    if (context == null) {
      return;
    }
    const rect = objectFitRect(
      style.objectFit,
      style.objectPosition,
      box,
      image
    );
    context.drawImage(
      img,
      rect.x * scale,
      rect.y * scale,
      rect.width * scale,
      rect.height * scale
    );
    // throws for an image from another origin, that one stays stretched
    const fitted = canvas.toDataURL();
    // the sources of a picture would win over the image's own src
    if (img.parentElement?.tagName === 'PICTURE') {
      img.parentElement
        .querySelectorAll('source')
        .forEach((source) => source.remove());
    }
    img.srcset = '';
    img.src = fitted;
    await decode(img);
  } catch (error) {
    console.debug('ws-thanos: could not fit image for the capture', error);
  }
}
