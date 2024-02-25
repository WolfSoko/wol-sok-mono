import { Locator, Page } from '@playwright/test';

export class AngularExamplesPage {
  experimentsTitle: Locator;
  mainTitle: Locator;
  constructor(private readonly page: Page) {
    this.experimentsTitle = page.locator('mat-card-title');
    this.mainTitle = page.locator('#main-toolbar');
  }
}
