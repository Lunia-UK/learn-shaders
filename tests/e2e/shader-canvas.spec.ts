import { expect, test, type Page } from '@playwright/test';
import type { ShaderView } from '../../src/engine/view';
import { pixelDistance } from './engine';

type CanvasWindow = Window & { shaderView: ShaderView | null };

const RED = 'vec3 color(vec2 uv) {\n  return vec3(1.0, 0.0, 0.0);\n}';
const BROKEN_ON_LINE_2 = 'vec3 color(vec2 uv) {\n  return vec3(foo);\n}';
const ANIMATED = 'vec3 color(vec2 uv) {\n  return vec3(fract(time));\n}';

async function openCheck(page: Page) {
  await page.goto('/dev/canvas');
  await page.waitForFunction(() => (window as unknown as CanvasWindow).shaderView != null);
}

/** Draws the current frame and returns the pixel at the center of the canvas. */
function centerPixel(page: Page) {
  return page.evaluate(() => {
    const view = (window as unknown as CanvasWindow).shaderView!;
    const canvas = document.querySelector('canvas')!;
    const pixels = view.capture();
    const x = Math.floor(canvas.width / 2);
    const y = Math.floor(canvas.height / 2);
    const i = (y * canvas.width + x) * 4;
    return Array.from(pixels.slice(i, i + 4));
  });
}

function framesDrawn(page: Page) {
  return page.evaluate(() => (window as unknown as CanvasWindow).shaderView!.framesDrawn);
}

test('renders the starting code', async ({ page }) => {
  await openCheck(page);
  // The starting code is vec3(uv, 0.5): about one half on every channel at the center.
  expect(pixelDistance(await centerPixel(page), [128, 128, 128, 255])).toBeLessThanOrEqual(1);
});

test('editing the code in the textarea updates the render', async ({ page }) => {
  await openCheck(page);
  await page.getByLabel('Shader code').fill(RED);
  await expect.poll(() => centerPixel(page)).toEqual([255, 0, 0, 255]);
});

test('a broken edit keeps the last image and shows the mapped error', async ({ page }) => {
  await openCheck(page);
  await page.getByLabel('Shader code').fill(RED);
  await expect.poll(() => centerPixel(page)).toEqual([255, 0, 0, 255]);

  await page.getByLabel('Shader code').fill(BROKEN_ON_LINE_2);
  const errors = page.getByRole('status');
  await expect(errors).toContainText('Line 2:');
  await expect(errors).toContainText('foo is not defined');
  expect(await centerPixel(page)).toEqual([255, 0, 0, 255]);

  // Fixing the code removes the message.
  await page.getByLabel('Shader code').fill(RED);
  await expect(errors).toHaveCount(0);
});

test('a still image is drawn once; code using time is drawn every frame', async ({ page }) => {
  await openCheck(page);
  const still = await framesDrawn(page);
  await page.waitForTimeout(300);
  expect(await framesDrawn(page)).toBe(still);
  await expect(page.getByRole('button', { name: /animation/ })).toHaveCount(0);

  await page.getByLabel('Shader code').fill(ANIMATED);
  const start = await framesDrawn(page);
  await expect.poll(() => framesDrawn(page)).toBeGreaterThan(start + 5);
  await expect(page.getByRole('button', { name: 'Pause animation' })).toBeVisible();

  await page.getByRole('button', { name: 'Pause animation' }).click();
  await page.waitForTimeout(100);
  const paused = await framesDrawn(page);
  await page.waitForTimeout(300);
  expect(await framesDrawn(page)).toBe(paused);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('animations start paused and play on request', async ({ page }) => {
    await openCheck(page);
    await page.getByLabel('Shader code').fill(ANIMATED);
    const play = page.getByRole('button', { name: 'Play animation' });
    await expect(play).toBeVisible();
    const paused = await framesDrawn(page);
    await page.waitForTimeout(300);
    expect(await framesDrawn(page)).toBe(paused);

    await play.click();
    await expect.poll(() => framesDrawn(page)).toBeGreaterThan(paused + 5);
  });
});

test.describe('on a high-density screen', () => {
  test.use({ deviceScaleFactor: 3 });

  test('caps the pixel ratio at 2 and follows resizes', async ({ page }) => {
    await openCheck(page);
    const size = () =>
      page.evaluate(() => {
        const canvas = document.querySelector('canvas')!;
        return { buffer: canvas.width, css: canvas.clientWidth };
      });
    await expect.poll(size).toEqual({ buffer: 640, css: 320 });

    // Shrink the frame: the drawing buffer follows.
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('#check')!.style.maxWidth = '200px';
    });
    await expect.poll(size).toEqual({ buffer: 400, css: 200 });
  });
});

test('shows a clear message when WebGL2 is not available', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext as (...args: unknown[]) => unknown;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value(this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        return type === 'webgl2' ? null : original.call(this, type, ...rest);
      },
    });
  });
  await page.goto('/dev/canvas');
  await expect(page.getByText('WebGL2 is not available')).toBeVisible();
});
