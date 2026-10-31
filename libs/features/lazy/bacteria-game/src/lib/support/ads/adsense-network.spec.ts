import {
  ADSENSE_SCRIPT_ID,
  AdSenseNetwork,
  AdSenseWindow,
  TcData,
  TCF_POLL_INTERVAL_MS,
} from './adsense-network';

describe('AdSenseNetwork', () => {
  const adsWindow = window as AdSenseWindow;
  let listeners: ((tcData: TcData, success: boolean) => void)[];
  let answered: jest.Mock;

  function network(): AdSenseNetwork {
    return new AdSenseNetwork(
      { network: 'adsense', client: 'ca-pub-1', slot: '42' },
      document
    );
  }

  function installCmp(): void {
    adsWindow.__tcfapi = (_command, _version, callback) => {
      listeners.push(callback);
    };
  }

  function report(tcData: TcData): void {
    for (const listener of listeners) listener(tcData, true);
  }

  beforeEach(() => {
    jest.useFakeTimers();
    listeners = [];
    answered = jest.fn();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    document.getElementById(ADSENSE_SCRIPT_ID)?.remove();
    delete adsWindow.__tcfapi;
    delete adsWindow.adsbygoogle;
    delete adsWindow.googlefc;
  });

  it('loads the ad script and listens for the consent', () => {
    installCmp();

    network().load(answered);

    const script = document.getElementById(ADSENSE_SCRIPT_ID);
    expect((script as HTMLScriptElement).src).toBe(
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1'
    );
    expect(listeners).toHaveLength(1);
  });

  it('listens once the script has brought the consent banner', () => {
    network().load(answered);
    expect(listeners).toHaveLength(0);

    installCmp();
    jest.advanceTimersByTime(TCF_POLL_INTERVAL_MS * 5);

    expect(listeners).toHaveLength(1);
  });

  it('stops waiting for the consent banner when the script is blocked', () => {
    network().load(answered);

    document
      .getElementById(ADSENSE_SCRIPT_ID)
      ?.dispatchEvent(new Event('error'));
    jest.advanceTimersByTime(TCF_POLL_INTERVAL_MS);
    installCmp();
    jest.advanceTimersByTime(TCF_POLL_INTERVAL_MS * 5);

    expect(listeners).toHaveLength(0);
  });

  it('waits for the player to answer the consent banner', () => {
    installCmp();
    network().load(answered);

    report({ eventStatus: 'cmpuishown' });
    expect(answered).not.toHaveBeenCalled();

    report({ eventStatus: 'useractioncomplete' });
    expect(answered).toHaveBeenCalled();
  });

  it('takes the answer of an earlier visit', () => {
    installCmp();
    network().load(answered);

    report({ eventStatus: 'tcloaded' });

    expect(answered).toHaveBeenCalled();
  });

  it('needs no answer where the GDPR does not apply', () => {
    installCmp();
    network().load(answered);

    report({ eventStatus: 'cmpuishown', gdprApplies: false });

    expect(answered).toHaveBeenCalled();
  });

  it('fills a responsive ad unit in the host and takes it out again', () => {
    const host = document.createElement('div');

    const remove = network().show(host);

    const unit = host.querySelector('ins.adsbygoogle');
    expect(unit?.getAttribute('data-ad-client')).toBe('ca-pub-1');
    expect(unit?.getAttribute('data-ad-slot')).toBe('42');
    expect(unit?.getAttribute('data-ad-format')).toBe('auto');
    expect(unit?.getAttribute('data-full-width-responsive')).toBe('true');
    expect(adsWindow.adsbygoogle).toEqual([{}]);

    remove();
    expect(host.children).toHaveLength(0);
  });

  it('opens the consent banner again once the consent data is ready', () => {
    network().openConsentSettings();
    // The consent script may set up its own object meanwhile.
    const queue = adsWindow.googlefc?.callbackQueue;
    const showRevocationMessage = jest.fn();
    adsWindow.googlefc = { callbackQueue: queue, showRevocationMessage };
    queue?.[0]?.['CONSENT_DATA_READY']?.();

    expect(showRevocationMessage).toHaveBeenCalled();
  });
});
