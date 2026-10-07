import type { Page } from '@playwright/test';

/** What /dev/engine puts on `window`. */
export type EngineWindow = Window & {
  engine: {
    gl: typeof import('../../src/engine/gl');
    assemble: typeof import('../../src/engine/assemble');
  };
};

/** Opens the engine harness page and waits until `window.engine` is ready. */
export async function openEngine(page: Page) {
  await page.goto('/dev/engine');
  await page.waitForFunction(() => 'engine' in window);
}

/** The byte a channel value between 0 and 1 is stored as. */
export const toByte = (value: number) => value * 255;

/** Compares RGBA bytes, allowing 1 of difference since GPUs may round either way. */
export function pixelDistance(actual: number[], expected: number[]): number {
  return Math.max(...actual.map((channel, i) => Math.abs(channel - expected[i])));
}
