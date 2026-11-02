import {
  AVATAR_COUNT,
  cleanMotto,
  cleanName,
  defaultProfile,
  isImageData,
  parseAvatar,
  parseProfile,
} from './profile';

describe('profile', () => {
  it('makes up a name and a drawn avatar from the uid', () => {
    const profile = defaultProfile('abc123');

    expect(profile.name).toMatch(/^Player \d{4}$/);
    expect(profile.avatar.kind).toBe('preset');
    expect(defaultProfile('abc123')).toEqual(profile);
    expect(profile.shareStatus).toBe(true);
    expect(defaultProfile('abc123', '  Ada  Lovelace ').name).toBe(
      'Ada Lovelace'
    );
  });

  it('keeps names and mottos short and tidy', () => {
    expect(cleanName('   ')).toBeNull();
    expect(cleanName('x'.repeat(40))).toHaveLength(24);
    expect(cleanMotto(' eat  or\nbe eaten ')).toBe('eat or be eaten');
    expect(cleanMotto('m'.repeat(100))).toHaveLength(80);
  });

  it('reads what it can of a stored profile', () => {
    expect(parseProfile(null, 'u')).toBeNull();
    expect(
      parseProfile(
        {
          name: 'Ada',
          motto: 'Divide!',
          avatar: { kind: 'preset', id: 3 },
          shareStatus: false,
        },
        'u'
      )
    ).toEqual({
      name: 'Ada',
      motto: 'Divide!',
      avatar: { kind: 'preset', id: 3 },
      shareStatus: false,
      publicName: false,
      boardOptOut: false,
      galleryOptOut: false,
    });
    const damaged = parseProfile({ name: 42, avatar: 'cat' }, 'u');
    expect(damaged).toEqual({ ...defaultProfile('u'), motto: '' });
  });

  it('keeps the name private and the player on the boards by default', () => {
    expect(defaultProfile('u')).toMatchObject({
      publicName: false,
      boardOptOut: false,
      galleryOptOut: false,
    });
    expect(
      parseProfile(
        {
          name: 'Ada',
          publicName: true,
          boardOptOut: true,
          galleryOptOut: 'yes',
        },
        'u'
      )
    ).toMatchObject({
      publicName: true,
      boardOptOut: true,
      galleryOptOut: false,
    });
  });

  it('takes only avatars the rules take', () => {
    expect(parseAvatar({ kind: 'preset', id: AVATAR_COUNT })).toBeNull();
    expect(parseAvatar({ kind: 'photo', url: 'http://x' })).toBeNull();
    expect(parseAvatar({ kind: 'photo', url: 'https://x/y.png' })).toBeNull();
    const photo = 'https://lh3.googleusercontent.com/a/ada=s96-c';
    expect(parseAvatar({ kind: 'photo', url: photo })).toEqual({
      kind: 'photo',
      url: photo,
    });
    expect(isImageData('data:image/webp;base64,AAAA')).toBe(true);
    expect(isImageData('data:image/svg+xml;base64,AAAA')).toBe(false);
    expect(isImageData(`data:image/png;base64,${'A'.repeat(40_000)}`)).toBe(
      false
    );
  });
});
