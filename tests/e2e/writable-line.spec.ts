import { expect, test, type Page } from '@playwright/test';

// Lesson 01-pixels/03-mix: line 4, "float t = uv.x;", is the one line the learner writes.
const LESSON = '/learn/pixels/mix/';

const field = (page: Page) =>
  page.getByRole('textbox', { name: 'Line 4: write this line yourself' });
const meter = (page: Page) => page.getByRole('meter', { name: 'Similarity to the target' });

async function openLesson(page: Page) {
  await page.goto(LESSON);
  await expect(field(page)).toHaveValue('float t = uv.x;');
}

test('the writable line is a text field, the rest of the code is locked', async ({ page }) => {
  await openLesson(page);
  await expect(page.locator('.cm-content')).toHaveAttribute('contenteditable', 'false');
  // Typing on a locked line changes nothing.
  await page.locator('.cm-line').first().click();
  await page.keyboard.type('oops');
  await expect(page.locator('.cm-content')).not.toContainText('oops');
});

test('writing the line and scrubbing color b solves the lesson', async ({ page }) => {
  await openLesson(page);
  await field(page).fill('float t = uv.y;');
  await expect(field(page)).toBeFocused();
  // The gradient now runs bottom to top; color b must become vec3(0.55, 0.15, 0.75).
  const numbers = page.locator('.cm-scrub');
  const moves: [number, string, number][] = [
    [3, 'ArrowUp', 35], // 0.20 → 0.55
    [4, 'ArrowDown', 15], // 0.30 → 0.15
    [5, 'ArrowDown', 5], // 0.80 → 0.75
  ];
  for (const [index, key, times] of moves) {
    await numbers.nth(index).focus();
    for (let i = 0; i < times; i++) await page.keyboard.press(key);
  }
  await expect(meter(page)).toHaveAttribute('aria-valuenow', '100');
  await expect(page.getByText('Solved! You wrote your first line of shader code.')).toBeVisible();
});

test('Enter does not add a line, and a broken line shows its error', async ({ page }) => {
  await openLesson(page);
  await field(page).press('End');
  await field(page).press('Enter');
  await expect(page.locator('.cm-line')).toHaveCount(6);

  await field(page).fill('float t = uv.z;');
  await expect(page.getByRole('status').filter({ hasText: 'Line 4:' })).toContainText(
    '.z does not exist on this vector',
  );
  await expect(page.locator('.cm-error-line')).toHaveCount(1);
});

test('Start over puts the original line back in the field', async ({ page }) => {
  await openLesson(page);
  await field(page).fill('float t = uv.y;');
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(field(page)).toHaveValue('float t = uv.x;');
});

test('free edit unlocks the whole code, guided mode locks it again', async ({ page }) => {
  await openLesson(page);
  const toggle = page.getByRole('button', { name: 'Edit all the code' });
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Back to guided mode' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(field(page)).toHaveCount(0);
  await expect(page.locator('.cm-content')).toHaveAttribute('contenteditable', 'true');

  // Type on line 1, which guided mode keeps locked.
  await page.locator('.cm-line').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' // mine');
  await expect(page.locator('.cm-content')).toContainText('// mine');

  await page.getByRole('button', { name: 'Back to guided mode' }).click();
  await expect(page.locator('.cm-content')).toHaveAttribute('contenteditable', 'false');
  await expect(field(page)).toHaveValue('float t = uv.x;');
  await expect(page.locator('.cm-content')).toContainText('// mine');
});
