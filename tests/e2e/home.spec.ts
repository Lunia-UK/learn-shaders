import { expect, test } from '@playwright/test';
import { site } from '../../src/config/site';

test('home page shows the site name from config', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(site.name);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(site.name);
});

test('the test browser has WebGL2', async ({ page }) => {
  await page.goto('/');
  const hasWebGL2 = await page.evaluate(
    () => document.createElement('canvas').getContext('webgl2') !== null,
  );
  expect(hasWebGL2).toBe(true);
});
