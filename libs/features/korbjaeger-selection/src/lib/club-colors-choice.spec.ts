import { colorsFromText, colorsText, byClub } from './club-colors-choice';

describe('the colours as stored text', () => {
  it.each([
    { primary: '#c8102e' },
    { primary: '#c8102e', secondary: '#1d4ed8' },
  ])('reads %j back as written', (colors) => {
    expect(colorsFromText(colorsText(colors))).toEqual(colors);
  });

  it.each([
    undefined,
    7,
    '',
    'rot',
    '#C8102E',
    ',#1d4ed8',
    '#c8102e,',
    '#c8102e,#1d4ed8,#007a3d',
    { primary: '#c8102e' },
  ])('reads %j as no colours', (text) => {
    expect(colorsFromText(text)).toBeUndefined();
  });
});

describe('byClub', () => {
  it('orders by the Verein id, leaving the list as it was', () => {
    const list = [
      { clubId: 4343, primary: '#1d4ed8' },
      { clubId: 4242, primary: '#c8102e' },
    ];

    expect(byClub(list).map(({ clubId }) => clubId)).toEqual([4242, 4343]);
    expect(list[0].clubId).toBe(4343);
  });
});
