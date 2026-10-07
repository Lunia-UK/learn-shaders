import { expect, test, type Page } from '@playwright/test';

// Lesson 01-pixels/01-one-color: the starter is vec3(0.20, 0.40, 0.90),
// the solution vec3(1.00, 0.55, 0.10).

const meter = (page: Page) => page.getByRole('meter', { name: 'Similarity to the target' });
const numbers = (page: Page) => page.locator('.cm-scrub');

async function openCheck(page: Page) {
  await page.goto('/dev/target');
  await expect(meter(page)).toHaveAttribute('aria-valuenow', /\d+/);
}

/** Moves the three numbers to the solution with the keyboard. */
async function solve(page: Page) {
  await numbers(page).nth(0).focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press('Shift+ArrowUp'); // red 0.20 → 1.00
  await numbers(page).nth(1).focus();
  await page.keyboard.press('Shift+ArrowUp'); // green 0.40 → 0.50
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowUp'); // green 0.50 → 0.55
  await numbers(page).nth(2).focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press('Shift+ArrowDown'); // blue 0.90 → 0.10
  await expect(numbers(page)).toHaveText(['1.00', '0.55', '0.10']);
}

test('the starter scores 0%: its colors are too far from the target', async ({ page }) => {
  await openCheck(page);
  // Byte differences 204 + 38 + 204 out of 3 × 255: 58% on average, doubled, is past 100%.
  await expect(meter(page)).toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByText('0%', { exact: true })).toBeVisible();
});

test('the score rises as the image gets closer', async ({ page }) => {
  await openCheck(page);
  await numbers(page).nth(0).focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press('Shift+ArrowUp');
  await numbers(page).nth(2).focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press('Shift+ArrowDown');
  // Only green is off now, by 0.15: mean difference 5%, doubled 10%, so 90%.
  await expect(meter(page)).toHaveAttribute('aria-valuenow', '90');
  await expect(page.getByText('Solved!')).toHaveCount(0);
});

test('reaching the target shows 100% and the success message', async ({ page }) => {
  await openCheck(page);
  await solve(page);
  await expect(meter(page)).toHaveAttribute('aria-valuenow', '100');
  await expect(page.getByRole('status')).toHaveText(
    'Solved! You just colored every pixel of the image.',
  );
});

test('the solved state is saved and still there after a reload', async ({ page }) => {
  await openCheck(page);
  await solve(page);
  const saved = await page.evaluate(() => localStorage.getItem('progress:v1'));
  expect(JSON.parse(saved!)).toEqual({ solved: ['01-pixels/01-one-color'] });

  await page.reload();
  await expect(meter(page)).toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByRole('status')).toHaveText('You already solved this lesson.');
});
