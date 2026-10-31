import {
  ADINPLAY_CONSENT_EVENTS,
  ADINPLAY_SCRIPT_ID,
  AdinPlayNetwork,
  AdinPlayWindow,
} from './adinplay-network';

describe('AdinPlayNetwork', () => {
  const adsWindow = window as AdinPlayWindow;
  let answered: jest.Mock;

  function network(): AdinPlayNetwork {
    return new AdinPlayNetwork(
      { network: 'adinplay', publisherId: 'BW', placementId: 'BW_menu' },
      document
    );
  }

  /** The loaded tag runs a queued call at once. */
  function loadTag(): { display: jest.Mock; destroy: jest.Mock } {
    const tag = { display: jest.fn(), destroy: jest.fn() };
    adsWindow.aipDisplayTag = tag;
    const queue = adsWindow.aiptag?.cmd?.display ?? [];
    queue.forEach((call) => call());
    queue.push = (...calls: (() => void)[]) => {
      calls.forEach((call) => call());
      return 0;
    };
    return tag;
  }

  beforeEach(() => {
    answered = jest.fn();
  });

  afterEach(() => {
    document.getElementById(ADINPLAY_SCRIPT_ID)?.remove();
    delete adsWindow.aiptag;
    delete adsWindow.aipDisplayTag;
    delete adsWindow.aipAPItag;
  });

  it('loads the tag with its settings set before', () => {
    network().load(answered);

    const script = document.getElementById(ADINPLAY_SCRIPT_ID);
    expect((script as HTMLScriptElement).src).toBe(
      'https://api.adinplay.com/libs/aiptag/pub/BW/tag.min.js'
    );
    expect(adsWindow.aiptag).toEqual({
      cmd: { display: [], player: [] },
      // The game's own buttons open the consent tool again.
      cmp: { show: true, button: false },
      disableInterstitialAd: true,
    });
  });

  it.each(ADINPLAY_CONSENT_EVENTS)(
    'takes %s as the answer of the consent tool',
    (event) => {
      network().load(answered);
      expect(answered).not.toHaveBeenCalled();

      document.dispatchEvent(new Event(event));

      expect(answered).toHaveBeenCalledTimes(1);
    }
  );

  it('answers once, whatever else the consent tool sends', () => {
    network().load(answered);

    document.dispatchEvent(new Event('aip_consentapproved'));
    document.dispatchEvent(new Event('aip_consent'));

    expect(answered).toHaveBeenCalledTimes(1);
  });

  it('waits for no other event of the consent tool', () => {
    network().load(answered);

    document.dispatchEvent(new Event('aip_consentscreen'));

    expect(answered).not.toHaveBeenCalled();
  });

  it('shows the placement in the host once the tag is there', () => {
    const ads = network();
    ads.load(answered);
    const host = document.createElement('div');
    document.body.appendChild(host);

    ads.show(host);
    expect(host.querySelector('#BW_menu')).not.toBeNull();
    const tag = loadTag();

    expect(tag.display).toHaveBeenCalledWith('BW_menu');
    host.remove();
  });

  it('destroys the placement and takes its element out', () => {
    const ads = network();
    ads.load(answered);
    const tag = loadTag();
    const host = document.createElement('div');

    const remove = ads.show(host);
    remove();

    expect(tag.destroy).toHaveBeenCalledWith('BW_menu');
    expect(host.children).toHaveLength(0);
  });

  it('opens the consent tool again', () => {
    const showCMPScreen = jest.fn();
    adsWindow.aipAPItag = { showCMPScreen };

    network().openConsentSettings();

    expect(showCMPScreen).toHaveBeenCalled();
  });

  it('opens nothing where the tag never loaded', () => {
    expect(() => network().openConsentSettings()).not.toThrow();
  });
});
