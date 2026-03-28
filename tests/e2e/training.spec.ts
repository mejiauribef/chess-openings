import { expect, test } from '@playwright/test';
import { openCoursePicker, waitForSelectedOpeningLoaded } from './helpers';

test('keeps the board playable and the current course visible', async ({ page }) => {
  test.setTimeout(180_000);
  await waitForSelectedOpeningLoaded(page);

  await expect(page.locator('.training-source-card').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.variation-item').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.training-stage-banner')).toBeVisible({ timeout: 30_000 });
});

test('loads a Sicilian course with real subvariations instead of an empty deck', async ({ page }) => {
  test.setTimeout(180_000);
  await waitForSelectedOpeningLoaded(page);

  await openCoursePicker(page);
  await page.getByPlaceholder('Ej: Sicilian, B90, Najdorf, e2e4').fill('Sicilian Defense');
  await expect(page.locator('.opening-list__item').first()).toBeVisible({ timeout: 30_000 });
  await page.locator('.opening-list__item').filter({ hasText: 'Sicilian Defense' }).first().click();

  await expect(page.locator('.variation-item').filter({ hasText: 'Sicilian' }).first()).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator('.training-source-card').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.playable-board')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('heading', { name: /Sicilian/i }).first()).toBeVisible({ timeout: 60_000 });
});
