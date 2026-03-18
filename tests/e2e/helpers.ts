import { expect, type Locator, type Page } from '@playwright/test';

async function waitForAppShell(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: /Aprende aperturas por posicion/i })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.locator('.opening-list__item').first()).toBeVisible({ timeout: 90_000 });
}

export async function gotoApp(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForAppShell(page);
}

export async function waitForSelectedOpeningLoaded(
  page: Page,
  options: { navigate?: boolean } = {},
): Promise<void> {
  if (options.navigate ?? true) {
    await gotoApp(page);
  } else {
    await waitForAppShell(page);
  }
  await expect(page.locator('.opening-list__item.is-active').first()).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.getByRole('heading', { name: 'Linea principal' })).toBeVisible({
    timeout: 120_000,
  });
}

export async function forceClick(locator: Locator): Promise<void> {
  await locator.evaluate((element) => {
    if (element instanceof HTMLElement) {
      element.click();
    }
  });
}

export async function forceFill(locator: Locator, value: string): Promise<void> {
  await locator.evaluate((element, nextValue) => {
    const field = element as HTMLInputElement | HTMLTextAreaElement;
    field.focus();
    field.value = nextValue;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}
