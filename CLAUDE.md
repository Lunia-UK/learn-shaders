# Learn Shaders

An interactive course that teaches GLSL fragment shaders by touching the code instead of reading math, and ends with a tool to build and export animated backgrounds. Free, fully open source, written in English.

"Learn Shaders" is a working name. The site name lives in exactly one place (`src/config/site.ts`); never hardcode it elsewhere.

The step-by-step build plan is in `PLAN.md`. Work through it in order, one task at a time, and tick the checkbox when a task meets its acceptance criteria. Working prototypes of the core interactions are in `prototypes/`; port their behavior, not their code structure.

## Product in one picture

One shared **engine** powers three spaces:

- **Course**: lessons in three layers, each with a target image to reproduce.
- **Playground**: the same editor with no target and no locks.
- **Export**: turns a shader into a dependency-free JS snippet, a React component or a PNG.

Anything built for the course must be reusable by the playground and the export.

## Teaching principles (these drive code decisions)

1. **One idea per lesson.** The core path of a lesson takes 5 minutes at most.
2. **Three layers per lesson.**
   - *Core*: the only required path. Short text, scrubbable numbers, a target to reproduce.
   - *Under the hood*: optional, written as real questions a learner would ask, placed inline where the question arises, collapsed by default.
   - *In the real world*: always last, same position and look in every lesson. Real site usage plus copyable code (vanilla JS, Three.js, React Three Fiber).
3. **The target only requires the core.** Never require knowledge from an optional layer to pass.
4. **Black box first, opened later.** A lesson may ship a ready-made helper (folded in the editor), as long as a later "Under the hood" opens it.
5. **Progressive writing.** Early lessons only allow scrubbing numbers. Then one writable line. Then the full editor.
6. **Every hard concept gets a visualization tool** (pixel probe, grid overlay, corner values, curve plot).

## Stack

- **Astro** (static output) with **React** islands for interactive parts. TypeScript everywhere, `strict: true`.
- **WebGL2**, hand-written. No three.js or other 3D library in the engine or in exported snippets. (Three.js appears only in "In the real world" code samples.)
- **CodeMirror 6** for the code view, with custom extensions for scrubbable numbers, inline value annotations, writable regions and folded helpers.
- **MDX** for lesson text, `.glsl` files for shader code.
- Progress in `localStorage`, wrapped in try/catch, no accounts.
- **Vitest** for unit tests, **Playwright** (Chromium with SwiftShader) for rendering tests.
- Static hosting (Vercel, Netlify or Cloudflare Pages). No server code.

Ask before adding any dependency not listed here.

## Repository layout

```
src/
  config/site.ts            # site name, URLs, one place only
  engine/                   # framework-free TypeScript, no DOM framework imports
    gl.ts                   # context, program compile/link, fullscreen triangle, FBOs, readPixels
    assemble.ts             # wraps lesson code into a full shader; maps error lines back
    explain.ts              # compiler messages in plain English
    view.ts                 # live shader on a canvas: last valid program, redraw on demand, DPR cap
    probe.ts                # source transform + float readback for the pixel probe
    score.ts                # similarity between render and target
    glsl-parse.ts           # number literals, top-level declarations, vec2 handles
    hash.glsl.ts            # shared GLSL helpers (sin-free hash, noise)
  editor/                   # CodeMirror extensions: GLSL language, theme, scrubbable numbers,
                            # line annotations (probe values)
  styles/tokens.css         # design tokens (colors, code font), light and dark
  components/               # React islands: ShaderCanvas, CodeView, ProbeOverlay,
                            # Handles, TargetPanel, DeepDive, RealWorld, LessonLayout, CourseMap
  lessons/                  # lesson frontmatter schema (Zod), paths, loading with .glsl code,
                            # progress (solved lessons in localStorage)
  content.config.ts         # content collections, uses lessons/schema.ts
  content/lessons/<chapter>/<lesson>/
    lesson.mdx              # frontmatter config + text + <DeepDive> + <RealWorld>
    starter.glsl            # code the learner starts from
    solution.glsl           # code that produces the target
  pages/                    # Astro routes
tests/
  unit/                     # engine tests (Vitest)
  e2e/                      # lesson rendering tests (Playwright)
prototypes/                 # reference HTML prototypes, not shipped
```

## Shader conventions

- Lesson code defines `vec3 color(vec2 uv)`. The engine wraps it with the header (version, precision, uniforms) and a `main()`; learners never see boilerplate.
- `uv` goes from (0, 0) bottom-left to (1, 1) top-right. Time is the uniform `float time` in seconds.
- Output is clamped to [0, 1] in the wrapper.
- Compile errors: keep rendering the last valid program, highlight the offending line using the mapped line number, show the message in plain English.
- Do not use `fract(sin(dot(...)))` as a hash outside the lesson that explains it. Use the sin-free hash in `hash.glsl.ts` (Dave Hoskins style) everywhere else.
- Cap device pixel ratio at 2. Render only when something changed, or every frame when the code uses `time`.

## Lesson content rules

- Every technical claim must be traceable to a primary source (Khronos GLSL ES / WebGL specs, MDN, original papers) or a recognized reference (Inigo Quilez articles, The Book of Shaders, Real-Time Rendering, GPU Gems, LearnOpenGL, WebGL2 Fundamentals). List sources in the lesson frontmatter.
- Each lesson keeps a `simplifications` list in its frontmatter: what is simplified, and where it is completed.
- If you (Claude) are unsure a statement is correct, say so in a `<!-- TODO verify: ... -->` comment rather than writing it confidently. The author verifies against sources before publishing.
- Plain, friendly English. Short sentences. No math notation in the core layer.

## Quality bar

- Every lesson: `starter.glsl` compiles, `solution.glsl` scores 100% against the target, the core layer works with every optional block collapsed. Enforced by `tests/e2e/lessons.spec.ts`.
- Keyboard accessible: scrubbable numbers are focusable sliders (arrow keys, Shift for bigger steps), handles move with arrows.
- Respect `prefers-reduced-motion` (pause animations by default) and `prefers-color-scheme`.
- Desktop first; mobile must stay readable and allow scrubbing and handles, not necessarily typing.
- WebGL2 unavailable: show a clear message, never a blank page.

## Commands

- `npm run dev`: local dev server (http://localhost:4321)
- `npm run build`: static build into `dist/`
- `npm run check`: TypeScript and Astro type check
- `npm run lint`: ESLint, then Prettier in check mode
- `npm run format`: apply Prettier formatting
- `npm test`: unit tests (Vitest, `tests/unit/**/*.test.ts`)
- `npm run test:e2e`: rendering tests (Playwright on the built site, Chromium with SwiftShader). First run needs `npx playwright install chromium`.

Node version is pinned in `.nvmrc`. CI (`.github/workflows/ci.yml`) runs lint, check, unit and e2e tests on every push.

## How to work in this repo

- One PLAN.md task per session or per commit. Read the task's acceptance criteria before starting; stop and report when they are met.
- Keep `src/engine/` free of React and Astro so the playground and export can reuse it.
- Write a unit test for every engine function with logic (parsing, source transforms, scoring).
- Prefer small, readable code over clever code: this codebase is also a learning resource.
- When a task reveals a decision the plan did not anticipate, stop and ask instead of guessing.
