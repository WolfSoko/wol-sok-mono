import { expect, Page, Locator } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly mainToolbar: Locator;
  readonly sideNavToggleButton: Locator;
  readonly sideNav: Locator;
  readonly navigationLinks: Locator;
  readonly aboutSection: Locator;
  readonly technologyCards: Locator;
  readonly thanosToggleButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mainToolbar = page.locator('#main-toolbar');
    this.sideNavToggleButton = page.locator('button[aria-label*="menu"]').first();
    this.sideNav = page.locator('mat-drawer');
    this.navigationLinks = page.locator('mat-drawer a[routerLink]');
    this.aboutSection = page.locator('app-about');
    this.technologyCards = page.locator('app-technology');
    this.thanosToggleButton = page.locator(
      'button[aria-label*="thanos"], button[matTooltip*="thanos"]'
    );
  }

  async goto() {
    await this.page.goto('/home');
  }

  async expectPageLoaded() {
    await expect(this.mainToolbar).toBeVisible();
    await expect(this.page).toHaveTitle(/WolSok|Experiments/);
  }

  async expectTitleVisible() {
    await expect(this.mainToolbar).toContainText('WolSok');
    await expect(this.mainToolbar).toContainText('Experiments');
  }

  async openSideNav() {
    const isOpen = await this.sideNav.evaluate((el: HTMLElement) => {
      return el.classList.contains('mat-drawer-opened');
    });
    
    if (!isOpen) {
      await this.sideNavToggleButton.click();
      await expect(this.sideNav).toHaveClass(/mat-drawer-opened/);
    }
  }

  async closeSideNav() {
    const isOpen = await this.sideNav.evaluate((el: HTMLElement) => {
      return el.classList.contains('mat-drawer-opened');
    });
    
    if (isOpen) {
      await this.sideNavToggleButton.click();
      await expect(this.sideNav).not.toHaveClass(/mat-drawer-opened/);
    }
  }

  async expectSideNavOpen() {
    await expect(this.sideNav).toHaveClass(/mat-drawer-opened/);
  }

  async expectSideNavClosed() {
    await expect(this.sideNav).not.toHaveClass(/mat-drawer-opened/);
  }

  async expectNavigationLinksVisible() {
    await expect(this.navigationLinks.first()).toBeVisible();
  }

  async getNavigationLinkCount(): Promise<number> {
    return await this.navigationLinks.count();
  }

  async clickNavigationLink(linkText: string) {
    await this.navigationLinks.filter({ hasText: linkText }).first().click();
  }

  async expectTechnologyCardsVisible() {
    await expect(this.technologyCards.first()).toBeVisible({ timeout: 10000 });
  }

  async getTechnologyCardCount(): Promise<number> {
    return await this.technologyCards.count();
  }

  async expectThanosToggleVisible() {
    await expect(this.thanosToggleButton).toBeVisible();
  }

  async clickThanosToggle() {
    await this.thanosToggleButton.click();
  }

  async expectThanosButtonShowsStop() {
    await expect(this.thanosToggleButton).toContainText('stop');
  }

  async expectThanosButtonShowsStart() {
    const icon = this.thanosToggleButton.locator('mat-icon');
    await expect(icon).not.toContainText('stop');
  }
}
