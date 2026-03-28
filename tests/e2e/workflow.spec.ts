import { expect, test } from '@playwright/test';
import { forceClick, openWorkspacePanel, gotoApp, waitForSelectedOpeningLoaded } from './helpers';

test('persists quick settings and repertoire across a reload', async ({ page }) => {
  test.setTimeout(180_000);
  await waitForSelectedOpeningLoaded(page);

  const quickMinimumDepth = page.locator('.focus-toolbar').getByRole('spinbutton', { name: 'Min' });
  await quickMinimumDepth.fill('6');
  await expect(quickMinimumDepth).toHaveValue('6');

  await openWorkspacePanel(page, 'Repertorio');
  await forceClick(page.getByRole('button', { name: 'Agregar a blancas' }));
  await expect(page.locator('.repertoire-card').first().getByText('Blancas')).toBeVisible({ timeout: 30_000 });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await gotoApp(page);
  await expect(page.locator('.focus-toolbar').getByRole('spinbutton', { name: 'Min' })).toHaveValue('6');

  await openWorkspacePanel(page, 'Repertorio');
  await expect(page.locator('.repertoire-card').first().getByText('Blancas')).toBeVisible({ timeout: 30_000 });
});
