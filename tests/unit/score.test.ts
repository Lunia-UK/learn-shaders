import { describe, expect, it } from 'vitest';
import { displayedScore, similarity } from '../../src/engine/score';

/** An image of `count` pixels, all of the same RGBA color. */
function solid(count: number, rgba: [number, number, number, number]): Uint8Array {
  const image = new Uint8Array(count * 4);
  for (let i = 0; i < image.length; i += 4) image.set(rgba, i);
  return image;
}

describe('similarity', () => {
  it('gives exactly 100 for identical images', () => {
    const image = solid(48 * 48, [255, 140, 26, 255]);
    expect(similarity(image, image.slice())).toBe(100);
  });

  it('gives 0 for opposite images', () => {
    expect(similarity(solid(4, [0, 0, 0, 255]), solid(4, [255, 255, 255, 255]))).toBe(0);
  });

  it('reaches 0 once the mean difference is half the range', () => {
    // Every channel differs by 128 of 255: a bit more than half.
    expect(similarity(solid(4, [0, 0, 0, 255]), solid(4, [128, 128, 128, 255]))).toBe(0);
  });

  it('doubles the mean difference', () => {
    // Red differs by 51 (20% of 255) on every pixel, green and blue match:
    // mean difference 20% / 3 channels, doubled, gives 1 - 0.1333 = 86.67.
    const score = similarity(solid(4, [51, 0, 0, 255]), solid(4, [0, 0, 0, 255]));
    expect(score).toBeCloseTo(86.667, 2);
  });

  it('averages over pixels', () => {
    // One pixel of 4 is fully different on every channel: mean difference 25%, doubled 50%.
    const image = solid(4, [0, 0, 0, 255]);
    image.set([255, 255, 255, 255], 0);
    expect(similarity(image, solid(4, [0, 0, 0, 255]))).toBeCloseTo(50, 6);
  });

  it('ignores alpha', () => {
    expect(similarity(solid(4, [10, 20, 30, 0]), solid(4, [10, 20, 30, 255]))).toBe(100);
  });

  it('refuses images of different sizes', () => {
    expect(() => similarity(solid(4, [0, 0, 0, 255]), solid(9, [0, 0, 0, 255]))).toThrow(
      'Images differ in size',
    );
  });
});

describe('displayedScore', () => {
  it('rounds down, so a lesson never looks solved before it is', () => {
    expect(displayedScore(96.99)).toBe(96);
    expect(displayedScore(100)).toBe(100);
  });
});
