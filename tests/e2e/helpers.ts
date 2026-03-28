import { expect, type Locator, type Page } from '@playwright/test';

async function waitForAppShell(page: Page): Promise<void> {
  await expect(page.locator('.focus-toolbar, .hero--study').first()).toBeVisible({
    timeout: 90_000,
  });
}

export async function gotoApp(page: Page): Promise<void> {
  await page.goto('/chess-openings/', { waitUntil: 'domcontentloaded' });
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

  await expect(page.getByRole('heading', { name: 'Practica', exact: true })).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.locator('.playable-board')).toBeVisible({
    timeout: 120_000,
  });
}

export async function openWorkspacePanel(page: Page, title: string): Promise<void> {
  await page.locator('.study-rail--focus .focus-panel-tabs__button').filter({ hasText: title }).first().click();
}

export async function openCoursePicker(page: Page): Promise<void> {
  await page.locator('.focus-toolbar').getByRole('button', { name: 'Cambiar apertura' }).click();
  await expect(page.getByPlaceholder('Ej: Sicilian, B90, Najdorf, e2e4')).toBeVisible({
    timeout: 30_000,
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
