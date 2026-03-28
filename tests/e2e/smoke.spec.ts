import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers';

test('renders the single-screen study workspace', async ({ page }) => {
  await gotoApp(page);
  await expect(page.locator('.focus-toolbar')).toBeVisible({ timeout: 120_000 });
  await expect(page.locator('.study-layout')).toBeVisible();
  await expect(page.locator('.training-stage-banner')).toBeVisible({ timeout: 120_000 });
  await expect(page.locator('.study-rail--focus .focus-panel-tabs__button').filter({ hasText: 'Detalle' }).first()).toBeVisible();
});
