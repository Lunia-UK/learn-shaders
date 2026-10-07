import { describe, expect, it } from 'vitest';
import { lessonSlug, readLessonFile, resolveLessonPath } from '../../src/lessons/paths';

describe('lessonSlug', () => {
  it('drops the ordering numbers from each part of the id', () => {
    expect(lessonSlug('01-pixels/01-one-color')).toBe('pixels/one-color');
  });

  it('keeps numbers that are part of a name', () => {
    expect(lessonSlug('03-motion/02-sin-2-waves')).toBe('motion/sin-2-waves');
  });
});

describe('resolveLessonPath', () => {
  it('resolves a file next to lesson.mdx', () => {
    expect(resolveLessonPath('01-pixels/01-one-color', './starter.glsl')).toBe(
      '/src/content/lessons/01-pixels/01-one-color/starter.glsl',
    );
  });

  it('resolves a file shared by a chapter', () => {
    expect(resolveLessonPath('01-pixels/01-one-color', '../shared/grid.glsl')).toBe(
      '/src/content/lessons/01-pixels/shared/grid.glsl',
    );
  });
});

describe('readLessonFile', () => {
  const files = { '/src/content/lessons/01-pixels/01-one-color/starter.glsl': 'vec3 color' };

  it('returns the file text', () => {
    expect(readLessonFile('01-pixels/01-one-color', 'starter', './starter.glsl', files)).toBe(
      'vec3 color',
    );
  });

  it('names the lesson, the field and the path when the file is missing', () => {
    expect(() =>
      readLessonFile('01-pixels/01-one-color', 'solution', './solution.glsl', files),
    ).toThrow(
      'Lesson "01-pixels/01-one-color": solution file "./solution.glsl" not found ' +
        '(looked for src/content/lessons/01-pixels/01-one-color/solution.glsl).',
    );
  });
});
