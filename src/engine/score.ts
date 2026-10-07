// How close the learner's image is to the target, from 0 to 100.

/** Both images are compared at this size: small enough to be fast, big enough to see shapes. */
export const TARGET_SIZE = 48;

/** Default similarity, in percent, needed to solve a lesson. */
export const PASS_THRESHOLD = 97;

/**
 * Similarity of two RGBA images of the same size, from 0 (very different) to 100 (identical).
 * The mean absolute difference of the red, green and blue bytes (alpha is ignored) is doubled
 * and taken from 1, so an average difference of half the range already scores 0.
 * Same formula as the chapter 1 prototype.
 */
export function similarity(image: Uint8Array, target: Uint8Array): number {
  if (image.length !== target.length) {
    throw new Error(`Images differ in size: ${image.length} and ${target.length} bytes`);
  }
  let total = 0;
  for (let i = 0; i < image.length; i += 4) {
    total +=
      Math.abs(image[i] - target[i]) +
      Math.abs(image[i + 1] - target[i + 1]) +
      Math.abs(image[i + 2] - target[i + 2]);
  }
  const pixels = image.length / 4;
  const meanDifference = total / (pixels * 3 * 255);
  return Math.max(0, 1 - meanDifference * 2) * 100;
}

/** The score as shown to the learner: rounded down, so 96.9 never shows as 97. */
export function displayedScore(score: number): number {
  return Math.floor(score);
}
