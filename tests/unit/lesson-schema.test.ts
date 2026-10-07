import { describe, expect, it } from 'vitest';
import { lessonSchema } from '../../src/lessons/schema';

const minimal = {
  title: 'One color',
  idea: 'A shader gives a color to every pixel.',
  estimatedMinutes: 2,
  starter: './starter.glsl',
  solution: './solution.glsl',
  hint: 'Lots of red.',
  success: 'Solved!',
  simplifications: [],
  sources: [{ title: 'The Book of Shaders', url: 'https://thebookofshaders.com/02/' }],
};

/** The paths and messages of the problems Zod finds, e.g. "editor.scrub: …". */
function problems(data: unknown): string[] {
  const result = lessonSchema.safeParse(data);
  return result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

describe('lessonSchema', () => {
  it('accepts a minimal lesson and fills in the defaults', () => {
    const lesson = lessonSchema.parse(minimal);
    expect(lesson.passThreshold).toBe(97);
    expect(lesson.prerequisites).toEqual([]);
    expect(lesson.tools).toEqual([]);
    expect(lesson.editor).toEqual({ scrub: 'all', writableLine: null, readOnly: true, folded: [] });
  });

  it('fills in editor defaults when only some editor fields are given', () => {
    const lesson = lessonSchema.parse({ ...minimal, editor: { scrub: ['red'] } });
    expect(lesson.editor).toEqual({
      scrub: ['red'],
      writableLine: null,
      readOnly: true,
      folded: [],
    });
  });

  it('names each missing required field', () => {
    const incomplete: Partial<typeof minimal> = { ...minimal };
    delete incomplete.title;
    delete incomplete.hint;
    const found = problems(incomplete);
    expect(found.some((p) => p.startsWith('title:'))).toBe(true);
    expect(found.some((p) => p.startsWith('hint:'))).toBe(true);
  });

  it('requires the starter and solution to be .glsl files', () => {
    expect(problems({ ...minimal, starter: './starter.txt' })).toEqual([
      'starter: must be the path of a .glsl file, relative to lesson.mdx (e.g. ./starter.glsl)',
    ]);
  });

  it('keeps the core of a lesson under 5 minutes', () => {
    expect(problems({ ...minimal, estimatedMinutes: 8 })).toEqual([
      'estimatedMinutes: a lesson core must fit in 5 minutes',
    ]);
  });

  it('requires at least one source', () => {
    expect(problems({ ...minimal, sources: [] })).toEqual([
      'sources: list at least one source for the claims in this lesson',
    ]);
  });

  it('rejects an unknown tool', () => {
    expect(problems({ ...minimal, tools: ['laser'] })[0]).toMatch(/^tools\.0:/);
  });

  it('requires the handles tool and the handles list to go together', () => {
    expect(problems({ ...minimal, handles: ['center'] })).toEqual([
      'tools: lists handles but not the "handles" tool',
    ]);
    expect(problems({ ...minimal, tools: ['handles'] })).toEqual([
      'handles: the "handles" tool is on but no vec2 declaration is listed',
    ]);
    expect(problems({ ...minimal, tools: ['handles'], handles: ['center'] })).toEqual([]);
  });

  it('checks that the prediction answer is one of the choices', () => {
    const prediction = { question: 'Grow or shrink?', choices: ['Grows', 'Shrinks'], answer: 2 };
    expect(problems({ ...minimal, prediction })).toEqual([
      'prediction.answer: must be the index of one of the 2 choices (starting at 0)',
    ]);
    expect(problems({ ...minimal, prediction: { ...prediction, answer: 1 } })).toEqual([]);
  });
});
