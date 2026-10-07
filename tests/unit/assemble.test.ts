import { describe, expect, it } from 'vitest';
import { assemble, parseCompileLog, UNIFORMS } from '../../src/engine/assemble';

// Compiler logs below were captured from Chromium (ANGLE), including the trailing NUL byte.

const GRADIENT = `vec3 color(vec2 uv) {
  return vec3(uv, 0.5);
}`;

const UNDECLARED_ON_LINE_3 = `vec3 color(vec2 uv) {
  float a = 1.0;
  return vec3(undeclaredThing);
}`;

const HELPERS = ['float helperA() { return 1.0; }\nfloat helperB() { return nope; }'];

/** The line of `source` at a 1-based line number. */
const lineAt = (source: string, line: number) => source.split('\n')[line - 1];

describe('assemble', () => {
  it('wraps a valid shader with the header and main()', () => {
    const { source, code } = assemble(GRADIENT);

    expect(source.startsWith('#version 300 es\n')).toBe(true);
    expect(source).toContain(`uniform vec2 ${UNIFORMS.resolution};`);
    expect(source).toContain(`uniform float ${UNIFORMS.time};`);
    expect(source).toContain('fragColor = vec4(clamp(color(uv), 0.0, 1.0), 1.0);');
    expect(lineAt(source, code.first)).toBe('vec3 color(vec2 uv) {');
    expect(lineAt(source, code.first + code.count - 1)).toBe('}');
  });

  it('places helpers between the header and the code', () => {
    const { source, helpers, code } = assemble(GRADIENT, { helpers: HELPERS });

    expect(helpers.count).toBe(2);
    expect(lineAt(source, helpers.first)).toBe('float helperA() { return 1.0; }');
    expect(code.first).toBe(helpers.first + helpers.count);
    expect(lineAt(source, code.first)).toBe('vec3 color(vec2 uv) {');
  });

  it('has an empty helper range when there are no helpers', () => {
    const { helpers, code } = assemble(GRADIENT);
    expect(helpers.count).toBe(0);
    expect(code.first).toBe(helpers.first);
  });
});

describe('parseCompileLog', () => {
  it('reports an undeclared identifier on line 3 as line 3', () => {
    const shader = assemble(UNDECLARED_ON_LINE_3);
    const log = `ERROR: 0:8: 'undeclaredThing' : undeclared identifier\n\0`;

    expect(parseCompileLog(log, shader)).toEqual([
      { line: 3, part: 'code', message: "'undeclaredThing' : undeclared identifier" },
    ]);
  });

  it('keeps reporting line 3 when helpers are prepended', () => {
    const shader = assemble(UNDECLARED_ON_LINE_3, { helpers: HELPERS });
    const log =
      "ERROR: 0:7: 'nope' : undeclared identifier\n" +
      "ERROR: 0:10: 'undeclaredThing' : undeclared identifier\n\0";

    expect(parseCompileLog(log, shader)).toEqual([
      { line: null, part: 'helpers', message: "'nope' : undeclared identifier" },
      { line: 3, part: 'code', message: "'undeclaredThing' : undeclared identifier" },
    ]);
  });

  it('reports one entry per error', () => {
    const shader = assemble(
      'vec3 color(vec2 uv) {\n  float a = foo;\n  float b = bar;\n  return vec3(a + b);\n}',
    );
    const log =
      "ERROR: 0:7: 'foo' : undeclared identifier\nERROR: 0:8: 'bar' : undeclared identifier\n\0";

    expect(parseCompileLog(log, shader).map((error) => error.line)).toEqual([2, 3]);
  });

  it('attributes errors in main() to the wrapper', () => {
    // The learner named the function `paint` instead of `color`.
    const shader = assemble('vec3 paint(vec2 uv) {\n  return vec3(uv, 0.0);\n}');
    const log = "ERROR: 0:12: 'color' : no matching overloaded function found\n\0";

    expect(parseCompileLog(log, shader)).toEqual([
      { line: null, part: 'wrapper', message: "'color' : no matching overloaded function found" },
    ]);
  });

  it('skips the summary line some compilers add', () => {
    const shader = assemble(UNDECLARED_ON_LINE_3);
    const log =
      "ERROR: 0:8: 'undeclaredThing' : undeclared identifier\n" +
      'ERROR: 1 compilation errors.  No code generated.\n';

    expect(parseCompileLog(log, shader)).toHaveLength(1);
  });

  it('keeps lines it cannot parse, without a line number', () => {
    const shader = assemble(GRADIENT);
    expect(parseCompileLog('Something went wrong', shader)).toEqual([
      { line: null, part: 'wrapper', message: 'Something went wrong' },
    ]);
  });
});
