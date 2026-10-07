// Pixel probe: shows, for one pixel, the value of every variable declared in `color()`.
//
// The GPU cannot print, so the code is rewritten to return one number at a time. A small image
// is drawn with one pixel per (variable, component): each pixel stores the 32 bits of its float
// in its 4 color bytes. Reading the image back gives exact values, all in one draw.

import { assemble, UNIFORMS } from './assemble';
import type { RenderTarget, Renderer, ShaderProgram } from './gl';
import { findDeclarations, maskComments } from './glsl-parse';

/** Types the probe can show, with their number of components. */
export const PROBE_TYPES = { float: 1, vec2: 2, vec3: 3, vec4: 4 } as const;
export type ProbeType = keyof typeof PROBE_TYPES;

/** Each variable gets 4 probe pixels, one per possible component. */
const SLOTS_PER_VALUE = 4;

export interface ProbeVariable {
  name: string;
  type: ProbeType;
  /** Line of the declaration in the learner's code (1-based). */
  line: number;
}

export interface ProbeTransform {
  /** The rewritten code: `float probeRun(vec2 uv)` instead of `vec3 color(vec2 uv)`. */
  code: string;
  variables: ProbeVariable[];
  /** Line of the `color` signature, where the probe shows `uv`. */
  signatureLine: number;
  /** Line of the final `return`, where the probe shows the pixel color. */
  returnLine: number | null;
}

export interface ProbeReading {
  uv: [number, number];
  variables: (ProbeVariable & { values: number[] })[];
  signatureLine: number;
  /** The color `color()` returns, before it is clamped to [0, 1]. */
  result: { line: number; values: number[] } | null;
}

const SIGNATURE = /\bvec3\s+color\s*\(\s*vec2\s+[A-Za-z_]\w*\s*\)\s*\{/;

/**
 * Rewrites lesson code so it can return any of its variables, chosen by `probeVar`
 * and `probeComponent`. Insertions stay on the same line, so line numbers do not change.
 * Returns null when the code has no `vec3 color(vec2 uv)` function.
 */
export function transformForProbe(code: string): ProbeTransform | null {
  const masked = maskComments(code);
  const signature = SIGNATURE.exec(masked);
  if (!signature) return null;
  const bodyStart = signature.index + signature[0].length;
  const bodyEnd = closingBrace(masked, bodyStart);
  if (bodyEnd === -1) return null;

  const edits: { at: number; remove: number; insert: string }[] = [];
  const insert = (at: number, text: string) => edits.push({ at, remove: 0, insert: text });

  // After each declaration at the top level of the body: return it if it is the one asked for.
  // Declarations in nested blocks or in a `for (…)` header are skipped.
  const variables: ProbeVariable[] = [];
  for (const declaration of findDeclarations(masked)) {
    if (declaration.from < bodyStart || declaration.to > bodyEnd) continue;
    if (!(declaration.type in PROBE_TYPES)) continue;
    if (!isTopLevel(masked, bodyStart, declaration.from)) continue;
    insert(
      declaration.to,
      ` if (probeVar == ${variables.length}) return probePick(${declaration.name});`,
    );
    variables.push({
      name: declaration.name,
      type: declaration.type as ProbeType,
      line: lineOf(code, declaration.from),
    });
  }

  // Every return now gives one float of its color.
  let returnLine: number | null = null;
  for (const match of masked.slice(bodyStart, bodyEnd).matchAll(/\breturn\b/g)) {
    const at = bodyStart + match.index;
    const semicolon = masked.indexOf(';', at);
    if (semicolon === -1 || semicolon > bodyEnd) continue;
    insert(at + 'return'.length, ' probePick(');
    insert(semicolon, ')');
    if (isTopLevel(masked, bodyStart, at) || returnLine === null) returnLine = lineOf(code, at);
  }

  const name = /vec3\s+color/.exec(masked.slice(signature.index))!;
  edits.push({
    at: signature.index + name.index,
    remove: name[0].length,
    insert: 'float probeRun',
  });

  // Apply from the end, so earlier offsets stay valid.
  edits.sort((a, b) => b.at - a.at);
  let transformed = code;
  for (const edit of edits) {
    transformed =
      transformed.slice(0, edit.at) + edit.insert + transformed.slice(edit.at + edit.remove);
  }
  return {
    code: transformed,
    variables,
    signatureLine: lineOf(code, signature.index),
    returnLine,
  };
}

// Declarations placed before the lesson code. `probeVar` and `probeComponent` are set by main().
const PROBE_PRELUDE = `uniform vec2 probeUV;
int probeVar;
int probeComponent;
float probePick(float v) { return v; }
float probePick(vec2 v) { return v[min(probeComponent, 1)]; }
float probePick(vec3 v) { return v[min(probeComponent, 2)]; }
float probePick(vec4 v) { return v[min(probeComponent, 3)]; }`;

// Pixel x of the probe image reports component (x % 4) of variable (x / 4).
// The value's 32 bits go out as 4 bytes, read back exactly by the page.
const PROBE_FOOTER = `
void main() {
  int slot = int(gl_FragCoord.x);
  probeVar = slot / ${SLOTS_PER_VALUE};
  probeComponent = slot % ${SLOTS_PER_VALUE};
  uint bits = floatBitsToUint(probeRun(probeUV));
  fragColor = vec4(
    float(bits & 255u),
    float((bits >> 8u) & 255u),
    float((bits >> 16u) & 255u),
    float(bits >> 24u)
  ) / 255.0;
}
`;

export interface ProbeShader extends ProbeTransform {
  /** Complete fragment shader for `Renderer.compile`. */
  source: string;
  /** Width of the probe image: 4 pixels per variable, plus 4 for the returned color. */
  width: number;
}

export function buildProbeShader(code: string, helpers: string[] = []): ProbeShader | null {
  const transform = transformForProbe(code);
  if (!transform) return null;
  const { source } = assemble(transform.code, {
    helpers: [PROBE_PRELUDE, ...helpers],
    footer: PROBE_FOOTER,
  });
  return { ...transform, source, width: (transform.variables.length + 1) * SLOTS_PER_VALUE };
}

/** Reads a float from 4 bytes, least significant first, as the probe shader writes them. */
export function decodeFloat(bytes: Uint8Array, offset = 0): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getFloat32(0, true);
}

/** Turns the probe image bytes into values for each variable and for the result. */
export function decodeReading(
  shader: ProbeTransform,
  bytes: Uint8Array,
  uv: [number, number],
): ProbeReading {
  const valuesAt = (index: number, count: number) =>
    Array.from({ length: count }, (_, c) => decodeFloat(bytes, (index * SLOTS_PER_VALUE + c) * 4));
  return {
    uv,
    signatureLine: shader.signatureLine,
    variables: shader.variables.map((variable, k) => ({
      ...variable,
      values: valuesAt(k, PROBE_TYPES[variable.type]),
    })),
    result:
      shader.returnLine === null
        ? null
        : { line: shader.returnLine, values: valuesAt(shader.variables.length, 3) },
  };
}

/** A value shown at the end of a code line. */
export interface LineAnnotation {
  /** Line in the learner's code (1-based). */
  line: number;
  text: string;
  /** A color to show next to the text, with channels from 0 to 1. */
  swatch?: [number, number, number];
}

/** Two decimals, like the numbers in lesson code. Tiny values show as 0.00, not -0.00. */
export function formatValue(value: number): string {
  if (Number.isNaN(value)) return 'NaN';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '-∞';
  return (Math.abs(value) < 0.005 ? 0 : value).toFixed(2);
}

const tuple = (values: number[]) => `(${values.map(formatValue).join(', ')})`;
const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

/** What to show at the end of each line for a probe reading. */
export function probeAnnotations(reading: ProbeReading): LineAnnotation[] {
  const annotations: LineAnnotation[] = [
    { line: reading.signatureLine, text: `uv = ${tuple(reading.uv)}` },
  ];
  for (const variable of reading.variables) {
    const { values } = variable;
    if (variable.type === 'vec3') {
      const [r, g, b] = values.map(clamp01);
      annotations.push({ line: variable.line, text: tuple(values), swatch: [r, g, b] });
    } else {
      const shown = variable.type === 'float' ? formatValue(values[0]) : tuple(values);
      annotations.push({ line: variable.line, text: `= ${shown}` });
    }
  }
  if (reading.result) {
    // The page shows the color clamped to [0, 1], so the probe does too.
    const pixel = reading.result.values.map(clamp01);
    annotations.push({
      line: reading.result.line,
      text: `pixel ${tuple(pixel)}`,
      swatch: [pixel[0], pixel[1], pixel[2]],
    });
  }
  return annotations;
}

/** Runs the probe on a renderer. Created and used by ShaderView, which shares its GPU context. */
export class PixelProbe {
  private shader: ProbeShader | null = null;
  private program: ShaderProgram | null = null;
  private target: RenderTarget | null = null;

  constructor(private readonly renderer: Renderer) {}

  /** Prepares the probe for new code. Returns false when the code cannot be probed. */
  setCode(code: string, helpers: string[] = []): boolean {
    this.freeProgram();
    const shader = buildProbeShader(code, helpers);
    const result = shader && this.renderer.compile(shader.source);
    if (!shader || !result || !result.ok) return false;
    this.shader = shader;
    this.program = result.program;
    if (!this.target || this.target.width !== shader.width) {
      if (this.target) this.renderer.freeTarget(this.target);
      this.target = this.renderer.createTarget(shader.width, 1);
    }
    return true;
  }

  /** Values at `uv`, computed with the same resolution and time as the image on screen. */
  read(uv: [number, number], resolution: [number, number], time: number): ProbeReading | null {
    if (!this.shader || !this.program || !this.target) return null;
    this.renderer.draw(this.program, {
      target: this.target,
      uniforms: { probeUV: uv, [UNIFORMS.resolution]: resolution, [UNIFORMS.time]: time },
    });
    return decodeReading(this.shader, this.renderer.readPixels({ target: this.target }), uv);
  }

  dispose(): void {
    this.freeProgram();
    if (this.target) this.renderer.freeTarget(this.target);
    this.target = null;
  }

  private freeProgram() {
    if (this.program) this.renderer.free(this.program);
    this.program = null;
    this.shader = null;
  }
}

/** Index of the `}` closing the block that starts at `from` (just after its `{`), or -1. */
function closingBrace(code: string, from: number): number {
  let depth = 1;
  for (let i = from; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

/** True when `offset` is outside any nested block and outside parentheses. */
function isTopLevel(code: string, bodyStart: number, offset: number): boolean {
  let braces = 0;
  let parens = 0;
  for (let i = bodyStart; i < offset; i++) {
    const char = code[i];
    if (char === '{') braces++;
    else if (char === '}') braces--;
    else if (char === '(') parens++;
    else if (char === ')') parens--;
  }
  return braces === 0 && parens === 0;
}

/** 1-based line number of an offset. */
function lineOf(code: string, offset: number): number {
  return code.slice(0, offset).split('\n').length;
}
