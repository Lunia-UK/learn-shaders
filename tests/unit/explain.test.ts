import { describe, expect, it } from 'vitest';
import type { ShaderError } from '../../src/engine/assemble';
import { explainErrors, explainMessage, humanizeType } from '../../src/engine/explain';

// Messages captured from Chromium (ANGLE) for common beginner mistakes.

describe('explainMessage', () => {
  const cases: [mistake: string, message: string, expected: string][] = [
    [
      'undeclared variable',
      "'foo' : undeclared identifier",
      '`foo` is not defined. Check the spelling, or declare it before using it.',
    ],
    [
      'missing semicolon',
      "'return' : syntax error",
      'The code is not complete before `return`. A missing `;` at the end of the line above is the usual cause.',
    ],
    [
      'int where a float is expected',
      "'=' : cannot convert from 'const int' to 'highp float'",
      'A whole number like `1` is an int. Where a float is expected, write it with a decimal point: `1.0`.',
    ],
    [
      'vec2 assigned to a vec3',
      "'=' : cannot convert from 'const 2-component vector of float' to 'highp 3-component vector of float'",
      'This value is a `vec2`, but a `vec3` is expected here.',
    ],
    [
      'float divided by an int',
      "'/' : wrong operand types - no operation '/' exists that takes a left-hand operand of type 'const float' and a right operand of type 'const int' (or there is no acceptable conversion)",
      '`/` cannot mix a float and an int. Write whole numbers with a decimal point: `2.0`, not `2`.',
    ],
    [
      'vec3 times vec2',
      "'*' : wrong operand types - no operation '*' exists that takes a left-hand operand of type 'const 3-component vector of float' and a right operand of type 'const 2-component vector of float' (or there is no acceptable conversion)",
      '`*` cannot combine a `vec3` and a `vec2`. Both sides usually need the same type.',
    ],
    [
      'returning uv',
      "'return' : function return is not matching type:",
      'The value after `return` is not the type the function promises. `color` must return a `vec3`.',
    ],
    [
      'vec3 with two numbers',
      "'constructor' : not enough data provided for construction",
      'Not enough values to build this: a `vec3` needs 3 numbers, a `vec2` needs 2.',
    ],
    [
      'mix with two arguments',
      "'mix' : no matching overloaded function found",
      '`mix` does not exist, or does not accept these values. Check the name, how many values you pass, and their types.',
    ],
    [
      'declared twice',
      "'a' : redefinition",
      '`a` is already declared above. To change its value, drop the type: `a = …;`',
    ],
    [
      'assigning to time',
      'l-value required (can\'t modify a uniform "time")',
      '`time` comes from the page and cannot be changed. Copy it into a new variable first: `float t = time;`',
    ],
    [
      'no return',
      "'color' : Function does not return a value",
      '`color` must end with `return` followed by a value, for example `return vec3(1.0);`',
    ],
    [
      'uv.z',
      "'z' : vector field selection out of range",
      '`.z` does not exist on this vector: a `vec2` only has `.x` and `.y`.',
    ],
  ];

  it.each(cases)('explains: %s', (_, message, expected) => {
    expect(explainMessage(message, 'code')).toBe(expected);
  });

  it('explains a missing color function', () => {
    expect(explainMessage("'color' : no matching overloaded function found", 'wrapper')).toBe(
      'Your code must define the function `vec3 color(vec2 uv)`.',
    );
  });

  it('explains a missing closing brace', () => {
    expect(explainMessage("'{' : syntax error", 'wrapper')).toBe(
      'Your code ends too early. Check that every `{` has a matching `}`.',
    );
  });

  it('returns messages it does not know unchanged', () => {
    expect(explainMessage('something new', 'code')).toBe('something new');
  });
});

describe('explainErrors', () => {
  const error = (line: number | null, part: ShaderError['part'], message: string) => ({
    line,
    part,
    message,
  });

  it('keeps only the first error of each line', () => {
    const explained = explainErrors([
      error(2, 'code', "'mix' : no matching overloaded function found"),
      error(2, 'code', "'return' : function return is not matching type:"),
      error(3, 'code', "'a' : redefinition"),
    ]);
    expect(explained.map((e) => [e.line, e.compilerMessage])).toEqual([
      [2, "'mix' : no matching overloaded function found"],
      [3, "'a' : redefinition"],
    ]);
  });

  it('drops wrapper errors when the code has errors', () => {
    const explained = explainErrors([
      error(2, 'code', "'foo' : undeclared identifier"),
      error(null, 'wrapper', "'constructor' : not enough data provided for construction"),
    ]);
    expect(explained).toHaveLength(1);
    expect(explained[0].part).toBe('code');
  });

  it('keeps only the first wrapper error when the code has none', () => {
    const explained = explainErrors([
      error(null, 'wrapper', "'color' : no matching overloaded function found"),
      error(null, 'wrapper', "'constructor' : not enough data provided for construction"),
    ]);
    expect(explained).toEqual([
      {
        line: null,
        part: 'wrapper',
        text: 'Your code must define the function `vec3 color(vec2 uv)`.',
        compilerMessage: "'color' : no matching overloaded function found",
      },
    ]);
  });
});

describe('humanizeType', () => {
  it.each([
    ['highp float', 'float'],
    ['const int', 'int'],
    ['const 2-component vector of float', 'vec2'],
    ['highp 4-component vector of int', 'ivec4'],
    ['3-component vector of bool', 'bvec3'],
    ['highp 2X2 matrix of float', '2X2 matrix of float'],
  ])('%s → %s', (input, expected) => {
    expect(humanizeType(input)).toBe(expected);
  });
});
