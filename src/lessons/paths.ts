// Turning lesson ids and the file paths in their frontmatter into URLs and file contents.

export const LESSONS_DIR = '/src/content/lessons';

/**
 * The URL path of a lesson: its id without the ordering numbers.
 * "01-pixels/01-one-color" becomes "pixels/one-color", so links survive reordering.
 */
export function lessonSlug(id: string): string {
  return id
    .split('/')
    .map((segment) => segment.replace(/^\d+-/, ''))
    .join('/');
}

/** Resolves a path written in a lesson's frontmatter (e.g. "./starter.glsl") from the project root. */
export function resolveLessonPath(lessonId: string, relativePath: string): string {
  // URL resolution handles "./" and "../" the same way a browser or bundler would.
  return new URL(relativePath, `file://${LESSONS_DIR}/${lessonId}/`).pathname;
}

/**
 * Returns the text of a file a lesson refers to.
 * `files` maps project-root paths to file contents (what `import.meta.glob` returns).
 */
export function readLessonFile(
  lessonId: string,
  field: string,
  relativePath: string,
  files: Record<string, string>,
): string {
  const path = resolveLessonPath(lessonId, relativePath);
  const text = files[path];
  if (text === undefined) {
    throw new Error(
      `Lesson "${lessonId}": ${field} file "${relativePath}" not found (looked for ${path.slice(1)}).`,
    );
  }
  return text;
}
