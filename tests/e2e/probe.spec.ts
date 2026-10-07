import { expect, test, type Page } from '@playwright/test';
import type { ProbeReading } from '../../src/engine/probe';

type CheckWindow = Window & { probeReading: ProbeReading | null };

async function openCheck(page: Page) {
  await page.goto('/dev/probe');
  await page.waitForFunction(() => (window as unknown as CheckWindow).probeReading != null);
}

function reading(page: Page) {
  return page.evaluate(() => (window as unknown as CheckWindow).probeReading);
}

const annotations = (page: Page) => page.locator('.cm-value');

/** Replaces the whole code in the editor. */
async function replaceCode(page: Page, code: string) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(code);
}

test('probed values match the values computed on the CPU', async ({ page }) => {
  await openCheck(page);
  // The starting code, worked out by hand for the starting probe position.
  const uv = [0.25, 0.75];
  const x = uv[0];
  const center = [0.5, 0.5];
  const d = Math.hypot(uv[0] - center[0], uv[1] - center[1]);
  const tint = [x, uv[1], 0.5];
  const result = tint.map((channel) => channel * (1 - d));

  const probed = (await reading(page))!;
  expect(probed.uv).toEqual(uv);
  const values = Object.fromEntries(probed.variables.map((v) => [v.name, v.values]));
  expect(values.x[0]).toBeCloseTo(x, 6);
  expect(values.center).toEqual(center);
  expect(values.d[0]).toBeCloseTo(d, 6);
  values.tint.forEach((value, i) => expect(value).toBeCloseTo(tint[i], 6));
  probed.result!.values.forEach((value, i) => expect(value).toBeCloseTo(result[i], 6));

  await expect(annotations(page)).toHaveText([
    'uv = (0.25, 0.75)',
    '= 0.25',
    '= (0.50, 0.50)',
    `= ${d.toFixed(2)}`,
    '(0.25, 0.75, 0.50)',
    `pixel (${result.map((v) => v.toFixed(2)).join(', ')})`,
  ]);
});

test('clicking the image moves the probe', async ({ page }) => {
  await openCheck(page);
  const frame = page.locator('canvas');
  const box = (await frame.boundingBox())!;
  // 80% from the left and 20% from the top is uv (0.80, 0.80).
  await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.2);
  await expect(annotations(page).first()).toHaveText('uv = (0.80, 0.80)');
  await expect(annotations(page).nth(1)).toHaveText('= 0.80');
});

test('the arrow keys move the probe, Shift makes bigger steps', async ({ page }) => {
  await openCheck(page);
  const marker = page.getByRole('button', { name: /Pixel probe/ });
  await marker.focus();
  await page.keyboard.press('ArrowRight');
  await expect(annotations(page).first()).toHaveText('uv = (0.26, 0.75)');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(annotations(page).first()).toHaveText('uv = (0.26, 0.70)');
  await expect(marker).toHaveAccessibleName(/uv \(0\.26, 0\.70\)/);
});

test('values follow the code as it changes', async ({ page }) => {
  await openCheck(page);
  await replaceCode(page, 'vec3 color(vec2 uv) {\nfloat k = 0.75;\nreturn vec3(k, 0.0, 2.0);\n}');
  await expect(annotations(page)).toHaveText([
    'uv = (0.25, 0.75)',
    '= 0.75',
    // The returned blue is 2.0, but the screen shows it as 1.0.
    'pixel (0.75, 0.00, 1.00)',
  ]);
});

test('an animated shader refreshes the values about 5 times per second', async ({ page }) => {
  await openCheck(page);
  await replaceCode(page, 'vec3 color(vec2 uv) {\nfloat t = time;\nreturn vec3(fract(t));\n}');
  await expect(annotations(page).nth(1)).toHaveText(/^= /);

  const changes = await page.evaluate(async () => {
    const seen = new Set<number>();
    const start = performance.now();
    while (performance.now() - start < 2000) {
      const probe = (window as unknown as CheckWindow).probeReading;
      if (probe) seen.add(probe.variables[0].values[0]);
      await new Promise((done) => setTimeout(done, 10));
    }
    return seen.size;
  });
  // 2 seconds at 5 per second: about 10 different values, never one per frame (120).
  expect(changes).toBeGreaterThanOrEqual(7);
  expect(changes).toBeLessThanOrEqual(13);
});
