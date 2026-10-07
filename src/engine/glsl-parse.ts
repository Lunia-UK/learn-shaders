// Small, purpose-built readers for lesson code: number literals and declarations.
// Not a full GLSL parser; lesson code is short and written in a simple style.

/** A float literal in the code, e.g. "0.20" or "-1.5". Integers like "2" are not included. */
export interface NumberLiteral {
  /** Offset of the first character, the minus sign included. */
  from: number;
  /** Offset just after the last character. */
  to: number;
  text: string;
  value: number;
  /** Digits after the decimal point. */
  decimals: number;
}

/** A variable declaration such as `float red = 0.20;`, from the type to the semicolon. */
export interface Declaration {
  name: string;
  type: string;
  from: number;
  to: number;
}

/** Replaces comments with spaces, so offsets stay the same but nothing inside them matches. */
export function maskComments(code: string): string {
  return code.replace(/\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/g, (comment) =>
    comment.replace(/[^\n]/g, ' '),
  );
}

// A float: digits with a decimal point, optionally an exponent. Not part of a name or a
// swizzle (the lookbehind rejects a letter, digit, underscore or dot just before).
const FLOAT = /(?<![\w.])(-?)(\d+\.\d*|\.\d+)([eE][+-]?\d+)?(?![\w.])/g;

// Keywords after which a minus sign is a sign, not a subtraction: `return -1.0;`
const SIGN_AFTER_WORDS = /\b(return|case)\s*$/;

export function findNumberLiterals(code: string): NumberLiteral[] {
  const masked = maskComments(code);
  const literals: NumberLiteral[] = [];
  for (const match of masked.matchAll(FLOAT)) {
    const [, minus, digits, exponent = ''] = match;
    let from = match.index;
    // The minus belongs to the number only when it is a sign: `vec2(-0.5)`, `x * -2.0`,
    // `return -1.0`. In `a -0.5` or `a - 0.5`, it is a subtraction.
    if (minus && !isSign(masked, from)) from += 1;
    const text = code.slice(from, match.index + match[0].length);
    literals.push({
      from,
      to: from + text.length,
      text,
      value: Number(text),
      decimals: exponent ? 0 : (digits.split('.')[1] ?? '').length,
    });
  }
  return literals;
}

/** True when the minus at `index` is a sign, judging from what comes before it. */
function isSign(code: string, index: number): boolean {
  const before = code.slice(0, index).trimEnd();
  if (before === '') return true;
  const last = before[before.length - 1];
  if (/[\w)\].]/.test(last)) return SIGN_AFTER_WORDS.test(before);
  return true;
}

const TYPES =
  'float|int|uint|bool|vec2|vec3|vec4|ivec2|ivec3|ivec4|uvec2|uvec3|uvec4|bvec2|bvec3|bvec4|mat2|mat3|mat4';
const DECLARATION = new RegExp(
  `(?<![\\w.])(?:const\\s+)?(?:(?:highp|mediump|lowp)\\s+)?(${TYPES})\\s+([A-Za-z_]\\w*)\\s*(?==|;)`,
  'g',
);

/** Finds variable declarations, each spanning from its type to the semicolon that ends it. */
export function findDeclarations(code: string): Declaration[] {
  const masked = maskComments(code);
  const declarations: Declaration[] = [];
  for (const match of masked.matchAll(DECLARATION)) {
    const end = masked.indexOf(';', match.index);
    declarations.push({
      type: match[1],
      name: match[2],
      from: match.index,
      to: end === -1 ? masked.length : end + 1,
    });
  }
  return declarations;
}

/**
 * The literals a learner may scrub: all of them, or only those inside the named declarations.
 * Literals written with an exponent (1e-3) are left out: dragging them would be confusing.
 */
export function scrubbableLiterals(code: string, scrub: 'all' | string[]): NumberLiteral[] {
  const literals = findNumberLiterals(code).filter((literal) => !/[eE]/.test(literal.text));
  if (scrub === 'all') return literals;
  const ranges = findDeclarations(code).filter((declaration) => scrub.includes(declaration.name));
  return literals.filter((literal) =>
    ranges.some((range) => literal.from >= range.from && literal.to <= range.to),
  );
}

/** The declaration a literal belongs to, to name it ("red, 0.20"). */
export function declarationAt(code: string, offset: number): Declaration | undefined {
  return findDeclarations(code).find((d) => offset >= d.from && offset < d.to);
}

/** Writes a scrubbed value with a fixed number of decimals, without "-0.00". */
export function formatNumber(value: number, decimals: number): string {
  const text = value.toFixed(decimals);
  return Number(text) === 0 ? text.replace('-', '') : text;
}

/**
 * Replaces a literal with new text. When a negative value lands right after a + or -,
 * a space is added (`a - -0.5`) so the result is not read as `--`, the decrement operator.
 * Returns the new code and where the literal now sits.
 */
export function replaceLiteral(
  code: string,
  literal: Pick<NumberLiteral, 'from' | 'to'>,
  text: string,
): { code: string; from: number; to: number } {
  const edit = literalEdit(code[literal.from - 1], literal.from, text);
  return { code: code.slice(0, literal.from) + edit.insert + code.slice(literal.to), ...edit };
}

/**
 * What to insert in place of a literal starting at `from`, given the character just before it,
 * and where the number itself lands. Shared by `replaceLiteral` and the code editor.
 */
export function literalEdit(
  charBefore: string | undefined,
  from: number,
  text: string,
): { insert: string; from: number; to: number } {
  const needsSpace = text.startsWith('-') && (charBefore === '-' || charBefore === '+');
  const insert = needsSpace ? ' ' + text : text;
  const start = from + insert.length - text.length;
  return { insert, from: start, to: start + text.length };
}
