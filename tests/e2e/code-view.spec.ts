import { expect, test, type Page } from '@playwright/test';
import type { ShaderView } from '../../src/engine/view';
import { pixelDistance, toByte } from './engine';

type CheckWindow = Window & { shaderView: ShaderView | null };

async function openCheck(page: Page) {
  await page.goto('/dev/code');
  await page.waitForFunction(() => (window as unknown as CheckWindow).shaderView != null);
  await expect(page.locator('.cm-scrub')).toHaveCount(3);
}

/** The code as CodeView reported it through onChange. */
async function codeLine(page: Page, line: number) {
  const text = await page.getByTestId('code').textContent();
  return text!.split('\n')[line - 1].trim();
}

function centerPixel(page: Page) {
  return page.evaluate(() => {
    const view = (window as unknown as CheckWindow).shaderView!;
    const canvas = document.querySelector('canvas')!;
    const pixels = view.capture();
    const i = (Math.floor(canvas.height / 2) * canvas.width + Math.floor(canvas.width / 2)) * 4;
    return Array.from(pixels.slice(i, i + 4));
  });
}

/** Drags with the mouse from the middle of an element, `dx` pixels sideways, in small moves. */
async function drag(page: Page, selector: string, dx: number, options: { shift?: boolean } = {}) {
  const box = (await page.locator(selector).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  if (options.shift) await page.keyboard.down('Shift');
  await page.mouse.move(x + dx, y, { steps: 10 });
  if (options.shift) await page.keyboard.up('Shift');
  await page.mouse.up();
}

test('only the numbers of the listed declarations are scrubbable', async ({ page }) => {
  await openCheck(page);
  const numbers = page.locator('.cm-scrub');
  await expect(numbers).toHaveText(['0.20', '0.40', '0.90']);
  await expect(numbers.first()).toHaveAttribute('role', 'spinbutton');
  await expect(numbers.first()).toHaveAccessibleName('red');
});

test('dragging a number changes the code and the render', async ({ page }) => {
  await openCheck(page);
  // 60 pixels at 0.005 per pixel: 0.20 becomes 0.50.
  await drag(page, '.cm-scrub >> nth=0', 60);
  expect(await codeLine(page, 2)).toBe('float red = 0.50;');
  expect(
    pixelDistance(await centerPixel(page), [toByte(0.5), toByte(0.4), toByte(0.9), 255]),
  ).toBeLessThanOrEqual(1);
});

test('Shift while dragging gives fine steps with three decimals', async ({ page }) => {
  await openCheck(page);
  // 50 pixels at 0.001 per pixel: 0.90 becomes 0.850.
  await drag(page, '.cm-scrub >> nth=2', -50, { shift: true });
  expect(await codeLine(page, 4)).toBe('float blue = 0.850;');
});

test('arrow keys change a focused number, Shift makes bigger steps', async ({ page }) => {
  await openCheck(page);
  await page.locator('.cm-scrub').nth(1).focus();
  await page.keyboard.press('ArrowUp');
  expect(await codeLine(page, 3)).toBe('float green = 0.41;');
  await page.keyboard.press('Shift+ArrowUp');
  expect(await codeLine(page, 3)).toBe('float green = 0.51;');
  await page.keyboard.press('ArrowLeft');
  expect(await codeLine(page, 3)).toBe('float green = 0.50;');
  // The number keeps the focus, so the keys can be pressed again and again.
  await expect(page.locator('.cm-scrub').nth(1)).toBeFocused();
});

test('Tab moves between the numbers', async ({ page }) => {
  await openCheck(page);
  await page.locator('.cm-scrub').first().focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('.cm-scrub').nth(1)).toBeFocused();
});

test('a click without a drag focuses the number', async ({ page }) => {
  await openCheck(page);
  await page.locator('.cm-scrub').nth(2).click();
  await expect(page.locator('.cm-scrub').nth(2)).toBeFocused();
  expect(await codeLine(page, 4)).toBe('float blue = 0.90;');
});

test('read-only code cannot be typed into', async ({ page }) => {
  await openCheck(page);
  await page.locator('.cm-content').click({ position: { x: 5, y: 5 } });
  await page.keyboard.type('oops');
  await expect(page.locator('.cm-content')).not.toContainText('oops');
});

test('scrubbing updates the editor in place instead of rebuilding it', async ({ page }) => {
  await openCheck(page);
  await page.evaluate(() => {
    (document.querySelector('.cm-editor') as HTMLElement & { marker?: boolean }).marker = true;
  });
  await drag(page, '.cm-scrub >> nth=0', 40);
  await page.locator('.cm-scrub').nth(1).focus();
  await page.keyboard.press('ArrowUp');
  const sameEditor = await page.evaluate(
    () => (document.querySelector('.cm-editor') as HTMLElement & { marker?: boolean }).marker,
  );
  expect(sameEditor).toBe(true);
});

test('free edit allows typing and makes every number scrubbable', async ({ page }) => {
  await openCheck(page);
  await page.getByLabel(/Free edit/).check();
  await expect(page.locator('.cm-scrub')).toHaveCount(4);
  // In editable code, numbers are not separate tab stops: the arrow keys move the cursor.
  await expect(page.locator('.cm-scrub').first()).not.toHaveAttribute('tabindex');

  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('\n// typed');
  expect(await page.getByTestId('code').textContent()).toContain('// typed');
});
