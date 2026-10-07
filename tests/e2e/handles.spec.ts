import { expect, test, type Page } from '@playwright/test';

// The circle level of the chapter 1 prototype: `vec2 center = vec2(0.50, 0.50);` is a handle,
// and the target is a bigger, blurrier circle at (0.35, 0.60).

const handle = (page: Page) => page.getByRole('button', { name: /^center at/ });

async function openCheck(page: Page) {
  await page.goto('/dev/handles');
  await expect(handle(page)).toBeVisible();
}

async function centerLine(page: Page) {
  const code = await page.getByTestId('code').textContent();
  return code!.split('\n')[1].trim();
}

/** Page coordinates of a uv position on the learner's image. */
async function pointAt(page: Page, u: number, v: number) {
  const box = (await page.getByRole('img', { name: 'Your image' }).boundingBox())!;
  return { x: box.x + u * box.width, y: box.y + (1 - v) * box.height };
}

async function handleCenter(page: Page) {
  const box = (await handle(page).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('dragging the handle with the mouse rewrites the vec2', async ({ page }) => {
  await openCheck(page);
  const from = await handleCenter(page);
  const to = await pointAt(page, 0.35, 0.6);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();

  expect(await centerLine(page)).toBe('vec2 center = vec2(0.35, 0.60);');
  await expect(handle(page)).toHaveAccessibleName(/center at \(0\.35, 0\.60\)/);
});

test('a handle cannot leave the image', async ({ page }) => {
  await openCheck(page);
  const from = await handleCenter(page);
  const box = (await page.getByRole('img', { name: 'Your image' }).boundingBox())!;
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 50, box.y - 50, { steps: 5 });
  await page.mouse.up();
  expect(await centerLine(page)).toBe('vec2 center = vec2(1.00, 1.00);');
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true });

  test('dragging the handle with a finger rewrites the vec2', async ({ page }) => {
    await openCheck(page);
    const from = await handleCenter(page);
    const to = await pointAt(page, 0.7, 0.25);
    // A real touch sequence, as the browser receives it from a touch screen.
    const touch = await page.context().newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
    for (let i = 1; i <= 8; i++) {
      const point = {
        x: from.x + ((to.x - from.x) * i) / 8,
        y: from.y + ((to.y - from.y) * i) / 8,
      };
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    expect(await centerLine(page)).toBe('vec2 center = vec2(0.70, 0.25);');
  });
});

test('the arrow keys move a focused handle, Shift makes bigger steps', async ({ page }) => {
  await openCheck(page);
  await handle(page).focus();
  await page.keyboard.press('ArrowLeft');
  expect(await centerLine(page)).toBe('vec2 center = vec2(0.49, 0.50);');
  await page.keyboard.press('Shift+ArrowUp');
  expect(await centerLine(page)).toBe('vec2 center = vec2(0.49, 0.55);');
  await expect(handle(page)).toBeFocused();
});

test('clicking away from the handle moves the probe, not the handle', async ({ page }) => {
  await openCheck(page);
  const point = await pointAt(page, 0.8, 0.2);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('.cm-value').first()).toHaveText('uv = (0.80, 0.20)');
  expect(await centerLine(page)).toBe('vec2 center = vec2(0.50, 0.50);');
});

test('the circle lesson can be solved with the handle and the numbers', async ({ page }) => {
  await openCheck(page);
  await handle(page).focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft'); // x 0.50 → 0.35
  for (let i = 0; i < 2; i++) await page.keyboard.press('Shift+ArrowUp'); // y 0.50 → 0.60
  expect(await centerLine(page)).toBe('vec2 center = vec2(0.35, 0.60);');

  // The edge: smoothstep(0.20, 0.22, d) must become smoothstep(0.15, 0.40, d).
  const numbers = page.locator('.cm-scrub');
  const edgeStart = numbers.filter({ hasText: '0.20' });
  await edgeStart.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown');
  const edgeEnd = numbers.filter({ hasText: '0.22' });
  await edgeEnd.focus();
  for (let i = 0; i < 18; i++) await page.keyboard.press('ArrowUp');

  await expect(page.getByRole('meter')).toHaveAttribute('aria-valuenow', '100');
  await expect(page.getByRole('status')).toContainText('A circle, with no drawing function');
});
