import { zeigen } from '../../testing/zeigen';
import { FusszeileComponent } from './fusszeile.component';

describe('FusszeileComponent', () => {
  it('links the privacy policy and the legal notice', () => {
    const fusszeile = zeigen(FusszeileComponent);

    const links = Array.from(fusszeile.querySelectorAll('nav a')).map((a) => [
      a.textContent?.trim(),
      a.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['Datenschutz', '/privacy'],
      ['Impressum', '/impressum'],
    ]);
  });

  it('names the DBB as the source and says its data may lag a few minutes', () => {
    const fusszeile = zeigen(FusszeileComponent);

    const text = fusszeile.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(text).toContain('Deutschen Basketball Bund');
    expect(text).toContain('einige Minuten');
    expect(
      fusszeile.querySelector('a[href="https://www.basketball-bund.net"]')
        ?.textContent
    ).toBe('basketball-bund.net');
  });
});
