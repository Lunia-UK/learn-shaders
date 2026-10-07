// Loads every lesson with its starter and solution code. Throws a clear error, which fails
// the build, when a lesson points to a .glsl file that does not exist.
import { getCollection, type CollectionEntry } from 'astro:content';
import { lessonSlug, readLessonFile } from './paths';

// Every .glsl file under the lessons folder, as text, keyed by path from the project root.
// import.meta.glob only accepts a literal string, so LESSONS_DIR cannot be used here.
const glslFiles = import.meta.glob<string>('/src/content/lessons/**/*.glsl', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export interface Lesson {
  /** e.g. "01-pixels/01-one-color" */
  id: string;
  /** e.g. "pixels/one-color", used in URLs */
  slug: string;
  entry: CollectionEntry<'lessons'>;
  starterCode: string;
  solutionCode: string;
}

/** All lessons, in course order (chapter folder, then lesson folder). */
export async function getLessons(): Promise<Lesson[]> {
  const entries = await getCollection('lessons');
  entries.sort((a, b) => a.id.localeCompare(b.id));

  const lessons = entries.map((entry) => ({
    id: entry.id,
    slug: lessonSlug(entry.id),
    entry,
    starterCode: readLessonFile(entry.id, 'starter', entry.data.starter, glslFiles),
    solutionCode: readLessonFile(entry.id, 'solution', entry.data.solution, glslFiles),
  }));

  const seen = new Map<string, string>();
  for (const lesson of lessons) {
    const other = seen.get(lesson.slug);
    if (other) {
      throw new Error(
        `Lessons "${other}" and "${lesson.id}" would both live at /learn/${lesson.slug}.`,
      );
    }
    seen.set(lesson.slug, lesson.id);
  }
  return lessons;
}
