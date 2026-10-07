// Turns compiler messages into plain English a beginner can act on.
// Patterns match the messages of ANGLE, the shader compiler behind WebGL in Chrome, Firefox and Safari.
// Code is written between backticks; the UI shows it as code.

import type { ShaderError, ShaderPart } from './assemble';

export interface ExplainedError {
  /** Line in the learner's code (1-based), or null when the error is elsewhere. */
  line: number | null;
  part: ShaderPart;
  /** What went wrong, in plain English. */
  text: string;
  /** The compiler's own words, for the curious. */
  compilerMessage: string;
}

/**
 * Explains a list of compiler errors. Only the first error of each line is kept: the next
 * ones are usually consequences of the first. Errors in the wrapper are only kept when the
 * learner's code has none, since they are usually consequences too.
 */
export function explainErrors(errors: ShaderError[]): ExplainedError[] {
  const inCode = errors.some((error) => error.part === 'code');
  const kept: ShaderError[] = [];
  const seenLines = new Set<number>();
  for (const error of errors) {
    if (error.part === 'wrapper' && (inCode || kept.length > 0)) continue;
    if (error.line !== null) {
      if (seenLines.has(error.line)) continue;
      seenLines.add(error.line);
    }
    kept.push(error);
  }
  return kept.map((error) => ({
    line: error.line,
    part: error.part,
    text: explainMessage(error.message, error.part),
    compilerMessage: error.message,
  }));
}

/** One rule: a pattern on the compiler message, and the explanation built from its groups. */
interface Rule {
  pattern: RegExp;
  explain: (match: RegExpExecArray, part: ShaderPart) => string;
}

const RULES: Rule[] = [
  {
    pattern: /^'color' : no matching overloaded function found/,
    explain: (_, part) =>
      part === 'wrapper'
        ? 'Your code must define the function `vec3 color(vec2 uv)`.'
        : 'No version of `color` accepts these arguments.',
  },
  {
    pattern: /^'(\w+)' : undeclared identifier/,
    explain: ([, name]) =>
      `\`${name}\` is not defined. Check the spelling, or declare it before using it.`,
  },
  {
    pattern: /^'(.+)' : syntax error/,
    explain: ([, token], part) =>
      part === 'wrapper'
        ? 'Your code ends too early. Check that every `{` has a matching `}`.'
        : `The code is not complete before \`${token}\`. A missing \`;\` at the end of the line above is the usual cause.`,
  },
  {
    pattern: /cannot convert from '(?:const )?int' to '(?:\w+ )?float'/,
    explain: () =>
      'A whole number like `1` is an int. Where a float is expected, write it with a decimal point: `1.0`.',
  },
  {
    pattern: /cannot convert from '(.+)' to '(.+)'/,
    explain: ([, from, to]) =>
      `This value is a \`${humanizeType(from)}\`, but a \`${humanizeType(to)}\` is expected here.`,
  },
  {
    pattern: /^'=' : dimension mismatch/,
    explain: () =>
      'Both sides must have the same number of components, for example a `vec3` on each side.',
  },
  {
    pattern:
      /^'(.+)' : wrong operand types - no operation .+ left-hand operand of type '(.+)' and a right operand of type '(.+?)'/,
    explain: ([, operator, left, right]) => {
      const types = [humanizeType(left), humanizeType(right)];
      if (types.includes('int') && types.includes('float')) {
        return `\`${operator}\` cannot mix a float and an int. Write whole numbers with a decimal point: \`2.0\`, not \`2\`.`;
      }
      return `\`${operator}\` cannot combine a \`${types[0]}\` and a \`${types[1]}\`. Both sides usually need the same type.`;
    },
  },
  {
    pattern: /^'return' : function return is not matching type/,
    explain: () =>
      'The value after `return` is not the type the function promises. `color` must return a `vec3`.',
  },
  {
    pattern: /^'constructor' : not enough data provided for construction/,
    explain: () => 'Not enough values to build this: a `vec3` needs 3 numbers, a `vec2` needs 2.',
  },
  {
    pattern: /^'constructor' : too many arguments/,
    explain: () => 'Too many values to build this: a `vec3` takes 3 numbers, a `vec2` takes 2.',
  },
  {
    pattern: /^'(\w+)' : no matching overloaded function found/,
    explain: ([, name]) =>
      `\`${name}\` does not exist, or does not accept these values. Check the name, how many values you pass, and their types.`,
  },
  {
    pattern: /^'(\w+)' : redefinition/,
    explain: ([, name]) =>
      `\`${name}\` is already declared above. To change its value, drop the type: \`${name} = …;\``,
  },
  {
    pattern: /can't modify a uniform "(\w+)"/,
    explain: ([, name]) =>
      `\`${name}\` comes from the page and cannot be changed. Copy it into a new variable first: \`float t = ${name};\``,
  },
  {
    pattern: /^'(\w+)' : Function does not return a value/,
    explain: ([, name]) =>
      `\`${name}\` must end with \`return\` followed by a value, for example \`return vec3(1.0);\``,
  },
  {
    pattern: /^'(\w+)' : vector field selection out of range/,
    explain: ([, field]) =>
      `\`.${field}\` does not exist on this vector: a \`vec2\` only has \`.x\` and \`.y\`.`,
  },
];

/** Explains one compiler message. Messages no rule knows are returned as they are. */
export function explainMessage(message: string, part: ShaderPart): string {
  for (const rule of RULES) {
    const match = rule.pattern.exec(message);
    if (match) return rule.explain(match, part);
  }
  return message;
}

/**
 * Turns the compiler's type names into GLSL ones:
 * "highp 3-component vector of float" becomes "vec3", "const int" becomes "int".
 */
export function humanizeType(type: string): string {
  const bare = type.replace(/\b(const|highp|mediump|lowp|in|out|inout)\s+/g, '').trim();
  const vector = /^(\d)-component vector of (float|int|uint|bool)$/.exec(bare);
  if (!vector) return bare;
  const prefix = { float: '', int: 'i', uint: 'u', bool: 'b' }[vector[2]];
  return `${prefix}vec${vector[1]}`;
}
