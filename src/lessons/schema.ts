// The frontmatter every lesson.mdx must have. Kept free of Astro imports so it can be unit tested;
// src/content.config.ts plugs it into the content collection.
import { z } from 'astro/zod';

const glslPath = z
  .string()
  .regex(
    /\.glsl$/,
    'must be the path of a .glsl file, relative to lesson.mdx (e.g. ./starter.glsl)',
  );

export const TOOLS = ['probe', 'handles', 'grid', 'timebar'] as const;

export const lessonSchema = z
  .object({
    title: z.string().min(1),
    /** The one idea of the lesson, in one sentence. */
    idea: z.string().min(1),
    prerequisites: z.array(z.string()).default([]),
    // Teaching principle 1: the core path takes 5 minutes at most.
    estimatedMinutes: z.number().int().min(1).max(5, 'a lesson core must fit in 5 minutes'),

    starter: glslPath,
    solution: glslPath,
    /** Similarity (in percent) needed to solve the lesson. */
    passThreshold: z.number().min(0).max(100).default(97),

    editor: z
      .object({
        /** Declarations whose numbers can be scrubbed, or "all". */
        scrub: z.union([z.literal('all'), z.array(z.string().min(1))]).default('all'),
        /** 1-based line of starter.glsl the learner may type on, or null. */
        writableLine: z.number().int().min(1).nullable().default(null),
        /** Everything except scrubbable numbers and the writable line is locked until free-edit mode. */
        readOnly: z.boolean().default(true),
        /** Shared helpers shown folded at the top of the editor. */
        folded: z.array(z.string().min(1)).default([]),
      })
      .prefault({}),

    tools: z.array(z.enum(TOOLS)).default([]),
    /** vec2 declarations shown as draggable handles on the canvas. */
    handles: z.array(z.string().min(1)).default([]),

    prediction: z
      .object({
        question: z.string().min(1),
        choices: z.array(z.string().min(1)).min(2).max(3),
        /** Index of the right choice, starting at 0. */
        answer: z.number().int().min(0),
      })
      .optional(),

    hint: z.string().min(1),
    success: z.string().min(1),

    simplifications: z.array(
      z.object({
        claim: z.string().min(1),
        reality: z.string().min(1),
        /** Id of the lesson that completes the picture, e.g. 08-gpu/02-vertex-and-fragment. */
        completedIn: z.string().min(1),
      }),
    ),
    sources: z
      .array(z.object({ title: z.string().min(1), url: z.url() }))
      .min(1, 'list at least one source for the claims in this lesson'),
  })
  .superRefine((lesson, ctx) => {
    if (lesson.handles.length > 0 && !lesson.tools.includes('handles')) {
      ctx.addIssue({
        code: 'custom',
        path: ['tools'],
        message: 'lists handles but not the "handles" tool',
      });
    }
    if (lesson.tools.includes('handles') && lesson.handles.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['handles'],
        message: 'the "handles" tool is on but no vec2 declaration is listed',
      });
    }
    if (lesson.prediction && lesson.prediction.answer >= lesson.prediction.choices.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['prediction', 'answer'],
        message: `must be the index of one of the ${lesson.prediction.choices.length} choices (starting at 0)`,
      });
    }
  });

export type LessonData = z.output<typeof lessonSchema>;
