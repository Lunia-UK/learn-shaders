import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { chapterSchema, lessonSchema } from './lessons/schema';
import { LESSONS_DIR } from './lessons/paths';

const lessons = defineCollection({
  loader: glob({
    pattern: '**/lesson.mdx',
    base: `.${LESSONS_DIR}`,
    // "01-pixels/01-one-color/lesson.mdx" gets the id "01-pixels/01-one-color".
    generateId: ({ entry }) => entry.replace(/\/lesson\.mdx$/, ''),
  }),
  schema: lessonSchema,
});

const chapters = defineCollection({
  loader: glob({
    pattern: '*/chapter.yaml',
    base: `.${LESSONS_DIR}`,
    // "01-pixels/chapter.yaml" gets the id "01-pixels".
    generateId: ({ entry }) => entry.replace(/\/chapter\.yaml$/, ''),
  }),
  schema: chapterSchema,
});

export const collections = { lessons, chapters };
