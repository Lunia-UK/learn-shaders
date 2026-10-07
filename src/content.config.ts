import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { lessonSchema } from './lessons/schema';
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

export const collections = { lessons };
