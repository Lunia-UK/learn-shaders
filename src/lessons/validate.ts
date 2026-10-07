// Checks that a lesson's config matches its starter code, so a typo in the frontmatter
// fails the build instead of silently turning a tool off.
import { findDeclarations, findVec2Handles } from '../engine/glsl-parse';
import type { LessonData } from './schema';

export function checkLessonCode(
  data: Pick<LessonData, 'editor' | 'handles'>,
  starter: string,
): string[] {
  const problems: string[] = [];

  if (data.editor.scrub !== 'all') {
    const declared = new Set(findDeclarations(starter).map((d) => d.name));
    for (const name of data.editor.scrub) {
      if (!declared.has(name)) {
        problems.push(`editor.scrub lists "${name}", but starter.glsl declares no "${name}".`);
      }
    }
  }

  const handles = new Set(findVec2Handles(starter).map((h) => h.name));
  for (const name of data.handles) {
    if (!handles.has(name)) {
      problems.push(
        `handles lists "${name}", but starter.glsl has no "vec2 ${name} = vec2(x, y);" with two numbers.`,
      );
    }
  }

  const lines = starter.split('\n').length;
  const { writableLine } = data.editor;
  if (writableLine !== null && writableLine > lines) {
    problems.push(`editor.writableLine is ${writableLine}, but starter.glsl has ${lines} lines.`);
  }

  return problems;
}
