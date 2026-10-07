import { describe, expect, it } from 'vitest';
import { drawingBufferSize } from '../../src/engine/view';

describe('drawingBufferSize', () => {
  it('uses the device pixel ratio for sharp pixels', () => {
    expect(drawingBufferSize(300, 200, 1.5)).toEqual({ width: 450, height: 300 });
  });

  it('caps the pixel ratio at 2', () => {
    expect(drawingBufferSize(300, 200, 3)).toEqual({ width: 600, height: 400 });
  });

  it('rounds to whole pixels and never returns 0', () => {
    expect(drawingBufferSize(100.4, 0, 1)).toEqual({ width: 100, height: 1 });
  });

  it('treats a missing pixel ratio as 1', () => {
    expect(drawingBufferSize(300, 200, 0)).toEqual({ width: 300, height: 200 });
  });
});
