import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers';

test('renders the single-screen study workspace', async ({ page }) => {
  await gotoApp(page);
  await expect(page.getByRole('heading', { name: /elige una apertura y practica/i })).toBeVisible();
  await expect(page.locator('.study-layout')).toBeVisible();
  await expect(page.locator('.course-card').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Practica', exact: true })).toBeVisible({ timeout: 120_000 });
});
