import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GAME_SUPPORT, GameSupportOptions } from './game-support';
import { GameSupport } from './game-support.service';
import { PlayBillingService, TipProduct } from './play-billing.service';

const OPTIONS: GameSupportOptions = {
  buyMeACoffeeHandle: 'wolf',
  playTipProductIds: ['tip_small', 'tip_large'],
  androidPackage: 'de.wolsok.bacteriawars',
  ads: null,
};

const PRODUCTS: TipProduct[] = [
  { id: 'tip_small', title: 'Small coffee', price: '€1.99' },
  { id: 'tip_large', title: 'Big coffee', price: '€4.99' },
];

describe('GameSupport', () => {
  let billing: {
    loadProducts: jest.Mock;
    consumePending: jest.Mock;
    buy: jest.Mock;
  };

  beforeEach(() => {
    billing = {
      loadProducts: jest.fn().mockResolvedValue(PRODUCTS),
      consumePending: jest.fn().mockResolvedValue(undefined),
      buy: jest.fn().mockResolvedValue('purchased'),
    };
    sessionStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    history.replaceState(null, '', '/');
  });

  async function setUp(
    options: GameSupportOptions | null = OPTIONS,
    referrer = ''
  ): Promise<GameSupport> {
    jest.spyOn(document, 'referrer', 'get').mockReturnValue(referrer);
    TestBed.configureTestingModule({
      providers: [
        { provide: GAME_SUPPORT, useValue: options },
        { provide: PlayBillingService, useValue: billing },
      ],
    });
    const support = TestBed.inject(GameSupport);
    TestBed.inject(ApplicationRef).tick();
    await Promise.resolve();
    await Promise.resolve();
    return support;
  }

  it('offers the Buy Me a Coffee page on the web', async () => {
    const support = await setUp();

    expect(support.url()).toBe('https://buymeacoffee.com/wolf');
    expect(support.tipProducts()).toEqual([]);
    expect(support.available()).toBe(true);
    expect(billing.loadProducts).not.toHaveBeenCalled();
  });

  it('offers the Play tips, never the page, inside the Play Store app', async () => {
    const support = await setUp(
      OPTIONS,
      'android-app://de.wolsok.bacteriawars/'
    );
    await Promise.resolve();

    expect(support.url()).toBeNull();
    expect(support.tipProducts()).toEqual(PRODUCTS);
    expect(billing.consumePending).toHaveBeenCalledWith(
      OPTIONS.playTipProductIds
    );
  });

  it('knows the app by the source its launch URL carries, as in the WebView', async () => {
    history.replaceState(null, '', '/?source=twa');

    const support = await setUp();

    expect(support.url()).toBeNull();
  });

  it('stays on the web when another app opened the game', async () => {
    const support = await setUp(
      OPTIONS,
      'android-app://com.google.android.gm/'
    );

    expect(support.url()).toBe('https://buymeacoffee.com/wolf');
    expect(billing.loadProducts).not.toHaveBeenCalled();
  });

  it('consumes leftover tips once billing answers', async () => {
    jest.useFakeTimers();
    billing.loadProducts.mockResolvedValueOnce(null);
    const support = await setUp(
      OPTIONS,
      'android-app://de.wolsok.bacteriawars/'
    );
    expect(billing.consumePending).not.toHaveBeenCalled();

    // The first retry waits two seconds.
    await jest.advanceTimersByTimeAsync(2000);

    expect(support.tipProducts()).toEqual(PRODUCTS);
    expect(billing.consumePending).toHaveBeenCalledWith(
      OPTIONS.playTipProductIds
    );
    jest.useRealTimers();
  });

  it('still knows it is in the app after a reload', async () => {
    sessionStorage.setItem('bacteria-game.twa', '1');

    const support = await setUp();

    expect(support.url()).toBeNull();
  });

  it('offers nothing without support options, as inside the shell', async () => {
    const support = await setUp(null);

    expect(support.available()).toBe(false);
  });

  it('thanks for a tip once it is paid', async () => {
    const support = await setUp(
      OPTIONS,
      'android-app://de.wolsok.bacteriawars/'
    );

    const tip = support.tip('tip_small');
    expect(support.tipBusy()).toBe(true);
    await tip;

    expect(billing.buy).toHaveBeenCalledWith('tip_small');
    expect(support.tipBusy()).toBe(false);
    expect(support.tipNotice()).toBe('thanks');
  });

  it('says so when a tip fails, and nothing when it is cancelled', async () => {
    const support = await setUp(
      OPTIONS,
      'android-app://de.wolsok.bacteriawars/'
    );

    billing.buy.mockRejectedValueOnce(new Error('no'));
    await support.tip('tip_small');
    expect(support.tipNotice()).toBe('failed');

    billing.buy.mockResolvedValueOnce('cancelled');
    await support.tip('tip_small');
    expect(support.tipNotice()).toBeNull();
  });
});
