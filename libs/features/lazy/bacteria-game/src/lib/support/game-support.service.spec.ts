import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GAME_SUPPORT, GameSupportOptions } from './game-support';
import { GameSupport } from './game-support.service';
import { PlayBillingService, TipProduct } from './play-billing.service';

const OPTIONS: GameSupportOptions = {
  buyMeACoffeeHandle: 'wolf',
  playTipProductIds: ['tip_small', 'tip_large'],
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
    expect(support.busyTip()).toBe('tip_small');
    await tip;

    expect(billing.buy).toHaveBeenCalledWith('tip_small');
    expect(support.busyTip()).toBeNull();
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
