import { expect, test } from '@playwright/test';
import { waitForSelectedOpeningLoaded } from './helpers';

test('shows the interactive training board and mode buttons', async ({ page }) => {
  test.setTimeout(180_000);
  await waitForSelectedOpeningLoaded(page);
  await page.keyboard.press('Alt+3');
  await expect(page.getByRole('heading', { name: 'Sesion de entrenamiento' })).toBeVisible({ timeout: 30_000 });

  // Verify mode buttons are visible
  await expect(page.locator('.mode-chip', { hasText: 'Learn' })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.mode-chip', { hasText: 'Practice' })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.mode-chip', { hasText: 'Drill' })).toBeVisible({ timeout: 10_000 });

  // Verify the playable board container exists
  await expect(page.locator('.playable-board')).toBeVisible({ timeout: 30_000 });

  // Verify info sidebar is displayed
  await expect(page.locator('.training-session__info')).toBeVisible({ timeout: 10_000 });
});

test('course selector bar is rendered and interactive', async ({ page }) => {
  test.setTimeout(180_000);
  await waitForSelectedOpeningLoaded(page);

  // Verify the course bar search input is visible
  await expect(page.locator('.course-bar__search')).toBeVisible({ timeout: 30_000 });

  // Type into the course selector and verify dropdown appears
  await page.locator('.course-bar__search').fill('Open');
  await expect(page.locator('.course-bar__dropdown')).toBeVisible({ timeout: 10_000 });
});
