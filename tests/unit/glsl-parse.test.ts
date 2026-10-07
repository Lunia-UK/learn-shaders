import { describe, expect, it } from 'vitest';
import {
  declarationAt,
  findDeclarations,
  findNumberLiterals,
  formatNumber,
  maskComments,
  replaceLiteral,
  scrubbableLiterals,
} from '../../src/engine/glsl-parse';

const texts = (code: string) => findNumberLiterals(code).map((literal) => literal.text);

const ONE_COLOR = `vec3 color(vec2 uv) {
  float red = 0.20;
  float green = 0.40;
  float blue = 0.90;
  return vec3(red, green, blue);
}`;

describe('maskComments', () => {
  it('blanks comments and keeps every offset', () => {
    const code = 'a = 1.0; // 2.0\n/* 3.0\n4.0 */ b';
    const masked = maskComments(code);
    expect(masked).toHaveLength(code.length);
    expect(masked).toBe('a = 1.0;       \n      \n       b');
  });
});

describe('findNumberLiterals', () => {
  it('finds floats with their position, value and decimals', () => {
    const code = 'float red = 0.20;';
    expect(findNumberLiterals(code)).toEqual([
      { from: 12, to: 16, text: '0.20', value: 0.2, decimals: 2 },
    ]);
  });

  it('accepts the short forms 1. and .5', () => {
    expect(texts('vec2(1., .5)')).toEqual(['1.', '.5']);
  });

  it('skips integers, digits inside names, and comments', () => {
    expect(texts('vec3 p1 = vec3(2) * 0.5; // 9.9\n/* 8.8 */')).toEqual(['0.5']);
  });

  it('includes a minus that is a sign', () => {
    expect(texts('vec2(-0.5, 0.2)')).toEqual(['-0.5', '0.2']);
    expect(texts('x * -2.0')).toEqual(['-2.0']);
    expect(texts('return -1.0;')).toEqual(['-1.0']);
    expect(texts('x = -0.25;')).toEqual(['-0.25']);
  });

  it('leaves out a minus that is a subtraction', () => {
    expect(texts('a - 0.5')).toEqual(['0.5']);
    expect(texts('a -0.5')).toEqual(['0.5']);
    expect(texts('f(x)-0.5')).toEqual(['0.5']);
    expect(texts('uv.x-0.5')).toEqual(['0.5']);
  });

  it('reads exponents but reports no decimals for them', () => {
    expect(findNumberLiterals('1.5e-3')).toEqual([
      { from: 0, to: 6, text: '1.5e-3', value: 0.0015, decimals: 0 },
    ]);
  });
});

describe('findDeclarations', () => {
  it('finds each declaration, from its type to its semicolon', () => {
    const code = 'vec2 center = vec2(0.5, 0.5);\nfloat d = distance(uv, center);';
    expect(findDeclarations(code)).toEqual([
      { type: 'vec2', name: 'center', from: 0, to: 29 },
      { type: 'float', name: 'd', from: 30, to: 61 },
    ]);
  });

  it('ignores function parameters and constructors', () => {
    expect(findDeclarations('vec3 color(vec2 uv) {\n  return vec3(uv, 0.0);\n}')).toEqual([]);
  });

  it('handles const and precision qualifiers', () => {
    expect(findDeclarations('const highp float PI = 3.14159;').map((d) => d.name)).toEqual(['PI']);
  });
});

describe('scrubbableLiterals', () => {
  it('returns every float with "all"', () => {
    expect(scrubbableLiterals(ONE_COLOR, 'all').map((l) => l.text)).toEqual([
      '0.20',
      '0.40',
      '0.90',
    ]);
  });

  it('keeps only the floats inside the named declarations', () => {
    expect(scrubbableLiterals(ONE_COLOR, ['red', 'blue']).map((l) => l.text)).toEqual([
      '0.20',
      '0.90',
    ]);
  });

  it('leaves out literals written with an exponent', () => {
    expect(scrubbableLiterals('float a = 1e-3 + 0.5;', 'all').map((l) => l.text)).toEqual(['0.5']);
  });
});

describe('declarationAt', () => {
  it('names the declaration a literal belongs to', () => {
    const literal = findNumberLiterals(ONE_COLOR)[1];
    expect(declarationAt(ONE_COLOR, literal.from)?.name).toBe('green');
  });
});

describe('formatNumber', () => {
  it('writes the given number of decimals', () => {
    expect(formatNumber(0.2, 2)).toBe('0.20');
    expect(formatNumber(0.1234, 3)).toBe('0.123');
  });

  it('never writes -0', () => {
    expect(formatNumber(-0.001, 2)).toBe('0.00');
  });
});

describe('replaceLiteral', () => {
  it('swaps the literal text and reports its new place', () => {
    const code = 'float red = 0.20;';
    expect(replaceLiteral(code, { from: 12, to: 16 }, '0.255')).toEqual({
      code: 'float red = 0.255;',
      insert: '0.255',
      from: 12,
      to: 17,
    });
  });

  it('adds a space so a negative value after a minus does not make --', () => {
    const code = 'a-0.50;';
    expect(replaceLiteral(code, { from: 2, to: 6 }, '-0.10')).toEqual({
      code: 'a- -0.10;',
      insert: ' -0.10',
      from: 3,
      to: 8,
    });
  });

  it('adds the space after a plus too', () => {
    expect(replaceLiteral('a+0.5', { from: 2, to: 5 }, '-0.5').code).toBe('a+ -0.5');
  });

  it('keeps the code as is when the value has its own sign slot', () => {
    expect(replaceLiteral('vec2(-0.50)', { from: 5, to: 10 }, '0.10').code).toBe('vec2(0.10)');
  });
});
