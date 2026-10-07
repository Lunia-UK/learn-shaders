// Turns lesson code (a `vec3 color(vec2 uv)` function) into a complete fragment shader,
// and maps compiler errors back to the lines the learner sees.

/** Uniform names the wrapper declares. Use these instead of writing the names by hand. */
export const UNIFORMS = {
  /** Size of the drawing area in pixels. */
  resolution: 'uRes',
  /** Seconds since the shader started. */
  time: 'time',
} as const;

const HEADER = `#version 300 es
precision highp float;
uniform vec2 ${UNIFORMS.resolution};
uniform float ${UNIFORMS.time};
out vec4 fragColor;
`;

// uv goes from (0, 0) at the bottom-left to (1, 1) at the top-right.
// The output is clamped so a color above 1 or below 0 shows as 1 or 0.
const FOOTER = `
void main() {
  vec2 uv = gl_FragCoord.xy / ${UNIFORMS.resolution};
  fragColor = vec4(clamp(color(uv), 0.0, 1.0), 1.0);
}
`;

/** A block of lines in the assembled source. `first` is 1-based, like compiler line numbers. */
export interface LineRange {
  first: number;
  count: number;
}

export interface AssembledShader {
  /** The complete fragment shader, ready for `Renderer.compile`. */
  source: string;
  helpers: LineRange;
  code: LineRange;
}

export interface AssembleOptions {
  /** Shared GLSL helpers (hash, noise…) placed before the lesson code. */
  helpers?: string[];
  /** Code placed after the lesson code. Defaults to the main() that draws `color(uv)`. */
  footer?: string;
}

/** Which part of the assembled shader an error comes from. */
export type ShaderPart = 'code' | 'helpers' | 'wrapper';

export interface ShaderError {
  /** Line in the learner's code (1-based), or null when the error is elsewhere. */
  line: number | null;
  part: ShaderPart;
  message: string;
}

export function assemble(
  code: string,
  { helpers = [], footer = FOOTER }: AssembleOptions = {},
): AssembledShader {
  const helperText = helpers.length > 0 ? helpers.join('\n') + '\n' : '';
  const helpersFirst = lineCount(HEADER) + 1;
  const helpersCount = lineCount(helperText);
  return {
    source: HEADER + helperText + code + '\n' + footer,
    helpers: { first: helpersFirst, count: helpersCount },
    code: { first: helpersFirst + helpersCount, count: lineCount(code + '\n') },
  };
}

// A compiler message looks like "ERROR: 0:7: 'foo' : undeclared identifier".
// 0 is the source string number (always 0 here), 7 the line in the assembled source.
const MESSAGE = /^(?:ERROR|WARNING): \d+:(\d+): (.*)$/;
// Some compiler versions end the log with "ERROR: 2 compilation errors.  No code generated."
// It repeats the errors above, so it is skipped.
const SUMMARY = /^(?:ERROR|WARNING): \d+ compilation errors?\./;

/** Splits a compiler log into one entry per error, with lines counted in the learner's code. */
export function parseCompileLog(log: string, shader: AssembledShader): ShaderError[] {
  const errors: ShaderError[] = [];
  for (const raw of log.split('\n')) {
    const text = raw.replace(/\0/g, '').trim();
    if (text === '' || SUMMARY.test(text)) continue;

    const match = MESSAGE.exec(text);
    if (!match) {
      errors.push({ line: null, part: 'wrapper', message: text });
      continue;
    }
    const sourceLine = Number(match[1]);
    const message = match[2].trim();
    if (isInside(sourceLine, shader.code)) {
      errors.push({ line: sourceLine - shader.code.first + 1, part: 'code', message });
    } else if (isInside(sourceLine, shader.helpers)) {
      errors.push({ line: null, part: 'helpers', message });
    } else {
      errors.push({ line: null, part: 'wrapper', message });
    }
  }
  return errors;
}

/** Number of lines a text adds to the source; every line ends with a newline. */
function lineCount(text: string): number {
  return text.split('\n').length - 1;
}

function isInside(line: number, range: LineRange): boolean {
  return line >= range.first && line < range.first + range.count;
}
