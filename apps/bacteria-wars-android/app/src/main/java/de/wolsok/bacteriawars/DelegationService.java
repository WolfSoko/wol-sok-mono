package de.wolsok.bacteriawars;

import com.google.androidbrowserhelper.playbilling.digitalgoods.DigitalGoodsRequestHandler;

/**
 * Answers Chrome's calls into the app: here the Digital Goods API, with which
 * the game sells its tips through Google Play Billing.
 */
public class DelegationService
    extends com.google.androidbrowserhelper.trusted.DelegationService {
  @Override
  public void onCreate() {
    super.onCreate();
    registerExtraCommandHandler(new DigitalGoodsRequestHandler(getApplicationContext()));
  }
}
