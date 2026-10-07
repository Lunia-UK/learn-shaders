import { describe, expect, it } from 'vitest';
import { checkLessonCode } from '../../src/lessons/validate';

const STARTER = `vec3 color(vec2 uv) {
  vec2 center = vec2(0.50, 0.50);
  float radius = 0.20;
  float d = distance(uv, center);
  return vec3(1.0 - smoothstep(radius, radius + 0.02, d));
}`;

const config = (overrides: {
  scrub?: 'all' | string[];
  handles?: string[];
  writableLine?: number | null;
}) => ({
  editor: {
    scrub: overrides.scrub ?? 'all',
    writableLine: overrides.writableLine ?? null,
    readOnly: true,
    folded: [],
  },
  handles: overrides.handles ?? [],
});

describe('checkLessonCode', () => {
  it('accepts names that exist in the starter', () => {
    expect(
      checkLessonCode(config({ scrub: ['radius'], handles: ['center'], writableLine: 3 }), STARTER),
    ).toEqual([]);
  });

  it('reports a scrub name the starter does not declare', () => {
    expect(checkLessonCode(config({ scrub: ['radius', 'raduis'] }), STARTER)).toEqual([
      'editor.scrub lists "raduis", but starter.glsl declares no "raduis".',
    ]);
  });

  it('reports a handle that is not a vec2 of two numbers', () => {
    expect(checkLessonCode(config({ handles: ['radius'] }), STARTER)).toEqual([
      'handles lists "radius", but starter.glsl has no "vec2 radius = vec2(x, y);" with two numbers.',
    ]);
  });

  it('reports a writable line past the end of the starter', () => {
    expect(checkLessonCode(config({ writableLine: 9 }), STARTER)).toEqual([
      'editor.writableLine is 9, but starter.glsl has 6 lines.',
    ]);
  });
});
