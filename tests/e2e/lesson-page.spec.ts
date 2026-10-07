import { expect, test } from '@playwright/test';

test('the first lesson is built from its lesson.mdx and starter.glsl', async ({ page }) => {
  await page.goto('/learn/pixels/one-color');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('One color');
  await expect(page.getByText('A shader is a small function')).toBeVisible();
  await expect(page.locator('pre code')).toContainText('float red = 0.20;');
});
