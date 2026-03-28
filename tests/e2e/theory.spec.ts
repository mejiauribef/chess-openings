import { expect, test } from '@playwright/test';
import { forceClick, openWorkspacePanel, waitForSelectedOpeningLoaded } from './helpers';

test('creates a local theory note from the course side panel', async ({ page }) => {
  test.setTimeout(180_000);
  await waitForSelectedOpeningLoaded(page);
  await openWorkspacePanel(page, 'Teoria');

  await expect(page.getByRole('heading', { name: 'Editor de teoria' })).toBeVisible({ timeout: 30_000 });
  await forceClick(page.getByRole('button', { name: 'Nueva nota' }));

  await page.getByLabel('Titulo').fill('Plan de prueba');
  await page.getByLabel('Resumen corto').fill('Resumen rapido para test.');
  await page.getByLabel('Markdown').fill('## Idea\n- Presionar el centro');
  await forceClick(page.getByRole('button', { name: 'Guardar nota' }));

  await expect(page.locator('.opening-list__item').filter({ hasText: 'Plan de prueba' }).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('.markdown-preview')).toContainText('Presionar el centro', { timeout: 30_000 });
});
