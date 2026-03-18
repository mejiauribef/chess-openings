import { expect, test } from '@playwright/test';
import { forceClick, gotoApp, waitForSelectedOpeningLoaded } from './helpers';

test('persists repertoire, settings and theory across a reload', async ({ page }) => {
  test.setTimeout(180_000);
  await waitForSelectedOpeningLoaded(page);

  await page.keyboard.press('Alt+4');
  await forceClick(page.getByRole('button', { name: 'Agregar a blancas' }));
  await expect(page.locator('.repertoire-card').first().getByText('Blancas')).toBeVisible();

  await page.keyboard.press('Alt+6');
  await forceClick(page.getByRole('button', { name: 'Drill rapido' }));
  await expect(page.getByLabel('Alcance del entrenamiento')).toHaveValue('repertoire');

  await page.keyboard.press('Alt+5');
  await forceClick(page.getByRole('button', { name: 'Nueva nota' }));
  await page.getByLabel('Titulo').fill('Persistencia local');
  await page.getByLabel('Resumen corto').fill('Nota guardada para validar reload.');
  await page.getByLabel('Markdown').fill('## Persistencia\n- La nota debe sobrevivir al reload');
  await forceClick(page.getByRole('button', { name: 'Guardar nota' }));
  await expect(page.locator('.opening-list__item').getByText('Persistencia local')).toBeVisible({ timeout: 30_000 });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await gotoApp(page);
  await page.keyboard.press('Alt+4');
  await expect(page.locator('.repertoire-card').first().getByText('Blancas')).toBeVisible({ timeout: 30_000 });

  await page.keyboard.press('Alt+6');
  await expect(page.getByLabel('Alcance del entrenamiento')).toHaveValue('repertoire');

  await page.keyboard.press('Alt+1');
  await waitForSelectedOpeningLoaded(page, { navigate: false });
  await page.keyboard.press('Alt+5');
  await expect(page.locator('.opening-list__item').getByText('Persistencia local')).toBeVisible({ timeout: 30_000 });
});
