import { describe, expect, it } from 'vitest';
import {
  buildProbeShader,
  decodeFloat,
  decodeReading,
  formatValue,
  probeAnnotations,
  transformForProbe,
  type ProbeReading,
} from '../../src/engine/probe';

const GRADIENT = `vec3 color(vec2 uv) {
  float x = uv.x;
  vec2 center = vec2(0.50, 0.50);
  float d = distance(uv, center); // how far from the middle
  vec3 tint = vec3(x, uv.y, 0.50);
  return tint * (1.0 - d);
}`;

describe('transformForProbe', () => {
  const transform = transformForProbe(GRADIENT)!;
  const lines = transform.code.split('\n');

  it('renames color() so it returns one float', () => {
    expect(lines[0]).toBe('float probeRun(vec2 uv) {');
  });

  it('lists the top-level declarations with their type and line', () => {
    expect(transform.variables).toEqual([
      { name: 'x', type: 'float', line: 2 },
      { name: 'center', type: 'vec2', line: 3 },
      { name: 'd', type: 'float', line: 4 },
      { name: 'tint', type: 'vec3', line: 5 },
    ]);
  });

  it('adds the early return on the same line as each declaration', () => {
    expect(lines[1]).toBe('  float x = uv.x; if (probeVar == 0) return probePick(x);');
    expect(lines[3]).toBe(
      '  float d = distance(uv, center); if (probeVar == 2) return probePick(d); // how far from the middle',
    );
  });

  it('wraps the return value and keeps the number of lines', () => {
    expect(lines[5]).toBe('  return probePick( tint * (1.0 - d));');
    expect(lines).toHaveLength(GRADIENT.split('\n').length);
  });

  it('knows where to show uv and the pixel color', () => {
    expect(transform.signatureLine).toBe(1);
    expect(transform.returnLine).toBe(6);
  });

  it('skips declarations in nested blocks and in for headers, and wraps nested returns', () => {
    const code = `vec3 color(vec2 uv) {
  float total = 0.0;
  for (float i = 0.0; i < 3.0; i += 1.0) {
    float step = i * 0.1;
    total += step;
  }
  if (uv.x > 0.9) {
    return vec3(1.0);
  }
  return vec3(total);
}`;
    const result = transformForProbe(code)!;
    expect(result.variables.map((v) => v.name)).toEqual(['total']);
    expect(result.code).toContain('    return probePick( vec3(1.0));');
    expect(result.returnLine).toBe(10);
  });

  it('ignores declarations of types it cannot show, and code outside color()', () => {
    const code = `float helper(float a) {
  float b = a * 2.0;
  return b;
}
vec3 color(vec2 uv) {
  int count = 3;
  return vec3(helper(uv.x));
}`;
    const result = transformForProbe(code)!;
    expect(result.variables).toEqual([]);
    expect(result.code).toContain('  return b;');
    expect(result.signatureLine).toBe(5);
  });

  it('returns null without a color function', () => {
    expect(transformForProbe('vec3 paint(vec2 uv) { return vec3(0.0); }')).toBeNull();
  });
});

describe('buildProbeShader', () => {
  it('makes a full shader with 4 probe pixels per variable plus 4 for the result', () => {
    const shader = buildProbeShader(GRADIENT)!;
    expect(shader.width).toBe(20);
    expect(shader.source.startsWith('#version 300 es')).toBe(true);
    expect(shader.source).toContain('uint bits = floatBitsToUint(probeRun(probeUV));');
  });
});

describe('decoding', () => {
  /** Bytes of floats, least significant first, as the probe shader writes them. */
  function bytesOf(values: number[]): Uint8Array {
    const data = new DataView(new ArrayBuffer(values.length * 4));
    values.forEach((value, i) => data.setFloat32(i * 4, value, true));
    return new Uint8Array(data.buffer);
  }

  it('reads back the exact float', () => {
    expect(decodeFloat(bytesOf([0.1]))).toBe(Math.fround(0.1));
  });

  it('gives each variable its components and the result its color', () => {
    const transform = transformForProbe(GRADIENT)!;
    // 4 slots per variable: x, center, d, tint, then the result.
    const slots = [
      [0.25, 0, 0, 0],
      [0.5, 0.5, 0, 0],
      [0.35, 0, 0, 0],
      [0.25, 0.75, 0.5, 0],
      [0.16, 0.48, 0.32, 0],
    ].flat();
    const reading = decodeReading(transform, bytesOf(slots), [0.25, 0.75]);
    expect(reading.variables.map((v) => v.values)).toEqual([
      [0.25],
      [0.5, 0.5],
      [Math.fround(0.35)],
      [0.25, 0.75, 0.5],
    ]);
    expect(reading.result).toEqual({
      line: 6,
      values: [0.16, 0.48, 0.32].map(Math.fround),
    });
  });
});

describe('probeAnnotations', () => {
  it('formats each line like the prototype', () => {
    const reading: ProbeReading = {
      uv: [0.25, 0.75],
      signatureLine: 1,
      variables: [
        { name: 'x', type: 'float', line: 2, values: [0.25] },
        { name: 'center', type: 'vec2', line: 3, values: [0.5, 0.5] },
        { name: 'tint', type: 'vec3', line: 5, values: [0.25, 0.75, 1.5] },
      ],
      result: { line: 6, values: [-0.2, 0.484, 1.3] },
    };
    expect(probeAnnotations(reading)).toEqual([
      { line: 1, text: 'uv = (0.25, 0.75)' },
      { line: 2, text: '= 0.25' },
      { line: 3, text: '= (0.50, 0.50)' },
      // The value is shown as it is; the swatch is clamped like the screen.
      { line: 5, text: '(0.25, 0.75, 1.50)', swatch: [0.25, 0.75, 1] },
      { line: 6, text: 'pixel (0.00, 0.48, 1.00)', swatch: [0, 0.484, 1] },
    ]);
  });
});

describe('formatValue', () => {
  it.each([
    [0.2, '0.20'],
    [-0.004, '0.00'],
    [-1.256, '-1.26'],
    [NaN, 'NaN'],
    [Infinity, '∞'],
  ])('%s → %s', (value, expected) => {
    expect(formatValue(value)).toBe(expected);
  });
});
