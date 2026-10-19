import { FONTS_URL, loadFonts } from './fonts';

describe('loadFonts', () => {
  afterEach(() =>
    document
      .querySelectorAll(`link[href="${FONTS_URL}"]`)
      .forEach((l) => l.remove())
  );

  it('links the fonts once', () => {
    loadFonts(document);
    loadFonts(document);

    expect(document.querySelectorAll(`link[href="${FONTS_URL}"]`)).toHaveLength(
      1
    );
  });
});
