import { expect, test, type Page } from '@playwright/test';

type EngineWindow = Window & { engineGL: typeof import('../../src/engine/gl') };

const GRADIENT = `#version 300 es
precision highp float;
uniform vec2 uRes;
out vec4 fragColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  fragColor = vec4(uv, 0.5, 1.0);
}`;

/** The byte a channel value between 0 and 1 is stored as. GPUs may round either way. */
const toByte = (value: number) => value * 255;

function expectPixel(actual: number[], expected: number[]) {
  expect(actual).toHaveLength(4);
  actual.forEach((channel, i) => expect(Math.abs(channel - expected[i])).toBeLessThanOrEqual(1));
}

async function openCheckPage(page: Page) {
  await page.goto('/dev/gl');
  await page.waitForFunction(() => 'engineGL' in window);
}

test('the check page draws the gradient and reads back its center pixel', async ({ page }) => {
  await openCheckPage(page);
  const canvas = page.locator('#view');
  await expect(canvas).toHaveAttribute('data-center-pixel', /^\d+,\d+,\d+,\d+$/);

  const pixel = (await canvas.getAttribute('data-center-pixel'))!.split(',').map(Number);
  // Pixel (128, 128) of 256 has its center at 128.5 / 256 on both axes.
  const uv = 128.5 / 256;
  expectPixel(pixel, [toByte(uv), toByte(uv), toByte(0.5), 255]);
});

test('an offscreen target reads back every pixel, bottom row first', async ({ page }) => {
  await openCheckPage(page);
  const size = 4;
  const pixels = await page.evaluate(
    ([source, size]) => {
      const { Renderer } = (window as unknown as EngineWindow).engineGL;
      const renderer = Renderer.create(document.createElement('canvas'))!;
      const result = renderer.compile(source);
      if (!result.ok) throw new Error(result.log);
      const target = renderer.createTarget(size, size);
      renderer.draw(result.program, { target, uniforms: { uRes: [size, size] } });
      const bytes = Array.from(renderer.readPixels({ target }));
      renderer.free(result.program);
      renderer.freeTarget(target);
      renderer.dispose();
      return bytes;
    },
    [GRADIENT, size] as const,
  );

  expect(pixels).toHaveLength(size * size * 4);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const i = (row * size + col) * 4;
      const expected = [toByte((col + 0.5) / size), toByte((row + 0.5) / size), toByte(0.5), 255];
      expectPixel(pixels.slice(i, i + 4), expected);
    }
  }
});

test('uniforms of each type are set, and unknown ones are ignored', async ({ page }) => {
  await openCheckPage(page);
  const source = `#version 300 es
precision highp float;
uniform vec3 tint;
uniform int mode;
uniform float strength;
out vec4 fragColor;
void main() {
  fragColor = vec4(mode == 2 ? tint * strength : vec3(0.0), 1.0);
}`;
  const pixel = await page.evaluate((source) => {
    const { Renderer } = (window as unknown as EngineWindow).engineGL;
    const renderer = Renderer.create(document.createElement('canvas'))!;
    const result = renderer.compile(source);
    if (!result.ok) throw new Error(result.log);
    const target = renderer.createTarget(1, 1);
    // `time` is not declared in this shader: it must be skipped, not throw.
    const uniforms = { tint: [1, 0.5, 0.25], mode: 2, strength: 0.5, time: 3 };
    renderer.draw(result.program, { target, uniforms });
    const bytes = Array.from(renderer.readPixels({ target }));
    renderer.dispose();
    return bytes;
  }, source);

  expectPixel(pixel, [toByte(0.5), toByte(0.25), toByte(0.125), 255]);
});

test('a broken shader returns the compiler log instead of throwing', async ({ page }) => {
  await openCheckPage(page);
  const result = await page.evaluate(() => {
    const { Renderer } = (window as unknown as EngineWindow).engineGL;
    const renderer = Renderer.create(document.createElement('canvas'))!;
    const result = renderer.compile(`#version 300 es
precision highp float;
out vec4 fragColor;
void main() {
  fragColor = vec4(undeclaredThing, 1.0);
}`);
    renderer.dispose();
    return result.ok ? { ok: true } : { ok: false, stage: result.stage, log: result.log };
  });

  expect(result).toMatchObject({ ok: false, stage: 'compile' });
  expect((result as { log: string }).log).toContain('undeclaredThing');
});
