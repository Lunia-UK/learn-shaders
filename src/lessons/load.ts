// Loads every lesson with its chapter, its starter and solution code. Throws a clear error,
// which fails the build, when a lesson points to a missing .glsl file, does not match its
// starter code, or sits in a folder without chapter.yaml.
import { getCollection, type CollectionEntry } from 'astro:content';
import { lessonSlug, readLessonFile } from './paths';
import { checkLessonCode } from './validate';

// Every .glsl file under the lessons folder, as text, keyed by path from the project root.
// import.meta.glob only accepts a literal string, so LESSONS_DIR cannot be used here.
const glslFiles = import.meta.glob<string>('/src/content/lessons/**/*.glsl', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export interface Chapter {
  /** e.g. "01-pixels" */
  id: string;
  /** From the folder name: "01-pixels" is chapter 1. */
  number: number;
  title: string;
}

export interface Lesson {
  /** e.g. "01-pixels/01-one-color" */
  id: string;
  /** e.g. "pixels/one-color", used in URLs */
  slug: string;
  /** Position in its chapter, starting at 1. */
  number: number;
  chapter: Chapter;
  entry: CollectionEntry<'lessons'>;
  starterCode: string;
  solutionCode: string;
}

/** The URL of a lesson page. */
export const lessonHref = (lesson: Pick<Lesson, 'slug'>) => `/learn/${lesson.slug}/`;

/** All lessons, in course order (chapter folder, then lesson folder). */
export async function getLessons(): Promise<Lesson[]> {
  const chapters = new Map(
    (await getCollection('chapters')).map((entry) => [
      entry.id,
      { id: entry.id, number: Number.parseInt(entry.id, 10), title: entry.data.title },
    ]),
  );
  const entries = await getCollection('lessons');
  entries.sort((a, b) => a.id.localeCompare(b.id));

  const countPerChapter = new Map<string, number>();
  const lessons = entries.map((entry): Lesson => {
    const chapterId = entry.id.split('/')[0];
    const chapter = chapters.get(chapterId);
    if (!chapter) {
      throw new Error(
        `Lesson "${entry.id}": its chapter folder has no chapter.yaml (expected src/content/lessons/${chapterId}/chapter.yaml).`,
      );
    }
    const number = (countPerChapter.get(chapterId) ?? 0) + 1;
    countPerChapter.set(chapterId, number);
    // Files end with a newline; the editor would show it as an empty last line.
    return {
      id: entry.id,
      slug: lessonSlug(entry.id),
      number,
      chapter,
      entry,
      starterCode: readLessonFile(entry.id, 'starter', entry.data.starter, glslFiles).trimEnd(),
      solutionCode: readLessonFile(entry.id, 'solution', entry.data.solution, glslFiles).trimEnd(),
    };
  });

  for (const lesson of lessons) {
    const problems = checkLessonCode(lesson.entry.data, lesson.starterCode);
    if (problems.length > 0) {
      throw new Error(`Lesson "${lesson.id}":\n- ${problems.join('\n- ')}`);
    }
  }

  const seen = new Map<string, string>();
  for (const lesson of lessons) {
    const other = seen.get(lesson.slug);
    if (other) {
      throw new Error(
        `Lessons "${other}" and "${lesson.id}" would both live at ${lessonHref(lesson)}.`,
      );
    }
    seen.set(lesson.slug, lesson.id);
  }
  return lessons;
}
