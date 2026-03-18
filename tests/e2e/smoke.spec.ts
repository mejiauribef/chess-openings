import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers';

test('renders the catalog shell', async ({ page }) => {
  await gotoApp(page);
  await expect(page.getByRole('heading', { name: /Aprende aperturas por posicion/i })).toBeVisible();
  await expect(page.locator('nav').getByText('Catalogo', { exact: true })).toBeVisible();
});
