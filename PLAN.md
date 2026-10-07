# Build plan

Work top to bottom. Each task lists what "done" means. Tick the box only when every criterion holds. Do not start a phase before the previous phase's gate is met.

The behavior to reproduce is demonstrated in `prototypes/`:

- `prototypes/chapter-1.html`: scrubbable numbers, pixel probe, draggable vec2 handles, target and similarity score, free-edit mode.
- `prototypes/lesson-noise.html`: the three layers, folded helper, single writable line, grid overlay with corner values, "Under the hood" demos, "In the real world" block with code tabs.

---

## Phase 0: foundations

Goal: one complete lesson runs from plain files, with all engine features working.

- [x] **0.1 Scaffold the project.**
  Astro + React + TypeScript (strict) + MDX, Vitest, Playwright, ESLint, Prettier. `src/config/site.ts` with the site name. GitHub Actions running lint, unit and e2e tests on each push.
  *Done when:* `npm run dev` shows a placeholder page with the site name from config, and CI is green.

- [x] **0.2 GL core (`src/engine/gl.ts`).**
  Create a WebGL2 context, compile and link programs from a fragment source, draw a fullscreen triangle, render to an offscreen FBO, read pixels back. Cache uniform locations. Free programs explicitly.
  *Done when:* a page renders a hardcoded gradient shader; a unit or e2e test reads back a pixel and checks its color.

- [x] **0.3 Shader assembly (`src/engine/assemble.ts`).**
  Wrap `vec3 color(vec2 uv)` code with header (version, precision, `uRes`, `time`) and `main()`. Optionally prepend shared helpers. Map compiler error line numbers back to the learner's code; turn the raw log into `{ line, message }`.
  *Done when:* unit tests cover a valid shader, an undeclared identifier on line 3 reported as line 3, and helpers prepended without shifting reported lines.

- [x] **0.4 Lesson format.**
  Define the lesson schema (see "Lesson schema" below) with Astro content collections and Zod. Create `content/lessons/01-pixels/01-one-color/` from prototype chapter 1, level 1.
  *Done when:* the build fails with a clear message if a lesson misses a required field or a referenced `.glsl` file.

- [x] **0.5 ShaderCanvas component.**
  React component that renders lesson code, keeps the last valid program on compile error, redraws only when needed (or every frame if the code uses `time`), caps DPR at 2, handles resize.
  *Done when:* editing code in a plain textarea updates the render; a broken edit leaves the last image and shows the mapped error.

- [x] **0.6 CodeView with scrubbable numbers.**
  CodeMirror 6 with GLSL highlighting. Extension: float literals become scrubbable (drag horizontally, Shift for fine steps, arrow keys when focused). Lesson config decides which numbers are scrubbable (all, or only in named declarations) and whether the rest is read-only.
  *Done when:* matches prototype behavior; scrubbing does not rebuild the editor on every frame; keyboard works; unit tests cover literal detection.

- [ ] **0.7 Pixel probe (`src/engine/probe.ts` + ProbeOverlay).**
  Port the prototype technique: transform the source so each top-level declaration can be returned as a float, render a 1×1 pass, read back exact float bits. Show values inline at the end of each code line; vec3 values get a color swatch. Click or drag on the canvas moves the probe.
  *Done when:* values shown match the CPU-computed expectation for a gradient shader (unit test on the transform, e2e test on values); refreshes ~5 times per second for animated shaders.

- [ ] **0.8 Target and similarity score (`src/engine/score.ts` + TargetPanel).**
  Render `solution.glsl` once at 48×48 as the target; compare the learner's render at the same size (mean absolute difference, same formula as the prototype). Show the meter; at 97% or above, mark the lesson solved and show the success message.
  *Done when:* unit tests on the score function; the solved state persists in localStorage.

- [ ] **0.9 Draggable handles.**
  Any `vec2 name = vec2(x, y);` declaration listed in the lesson config becomes a handle on the canvas. Dragging rewrites the two literals; code view and render follow.
  *Done when:* the circle lesson from the prototype works with mouse, touch and arrow keys.

- [ ] **0.10 LessonLayout.**
  Two columns on desktop (text and code left, sticky render and target right), single column under 900px. Hint button, reset button, progress dots for the chapter. Light and dark themes.
  *Done when:* lesson 01-one-color is fully playable and matches the prototype's feel.

**Gate 0:** a complete lesson runs from `lesson.mdx` + `starter.glsl` + `solution.glsl` without touching engine code.

---

## Phase 1: the first chapter

Goal: chapter 1 is complete and validated with real beginners.

- [ ] **1.1 Lessons 1.1 to 1.5** (one color, every pixel knows its place, mixing two colors, distance and circle, color points). Port from the prototype, then rewrite the text following the content rules in `CLAUDE.md`. Add a prediction question to each lesson.
- [ ] **1.2 Writable line mode.** A lesson can mark one line as writable while the rest stays read-only (prototype noise lesson). Free-edit toggle unlocks everything.
- [ ] **1.3 Prediction questions.** Component: question + 2 or 3 choices, shown before the learner can scrub; reveals the result after a choice.
- [ ] **1.4 DeepDive component.** Collapsible "Under the hood" block, inline in the MDX, with a "always expand explanations" preference saved locally. Can embed small demo canvases.
- [ ] **1.5 RealWorld component.** Fixed block at the end of each lesson: short text, an optional live demo, code tabs (GLSL, vanilla JS, Three.js, React Three Fiber) with a copy button.
- [ ] **1.6 Chapter 1 creation.** End-of-chapter page: build a gradient from what was learned and export it (vanilla JS snippet only for now).
- [ ] **1.7 Lesson e2e test.** `tests/e2e/lessons.spec.ts` loops over all lessons: starter compiles, solution scores 100%, page has no console errors.

**Gate 1:** two or three people new to shaders finish chapter 1 without help and can explain in their own words what `uv`, `mix` and `distance` do. Their feedback is written in `docs/feedback/chapter-1.md`.

---

## Phase 2: chapters 2 to 4 and the playground

- [ ] **2.1** Chapter 2, shapes (7 lessons).
- [ ] **2.2** Chapter 3, motion (6 lessons). Adds a time bar: pause, scrub time, speed.
- [ ] **2.3** Chapter 4, repetition (6 lessons). Adds the grid overlay tool.
- [ ] **2.4** Playground page: full editor, all tools, no target. Color picker on `vec3` literals, curve plot when hovering `sin`, `smoothstep`, `fract`, `mix`. Examples to start from. Shareable URL that encodes the code.
- [ ] **2.5** Course map page: chapters as a map, chapters 2 to 5 in any order, progress shown.

**Gate 2:** a few testers used chapters 2 to 4; their blocking points are fixed; no reported error is left open.

---

## Phase 3: part 1 complete

- [ ] **3.1** Chapter 5, color (5 lessons).
- [ ] **3.2** Chapter 6, randomness (6 lessons). Port the noise prototype; the hash lesson explains why `fract(sin)` is fragile and introduces the sin-free hash.
- [ ] **3.3** Chapter 7, warping space (6 lessons), ending with the animated mesh gradient project.
- [ ] **3.4** Export: vanilla JS snippet with best practices (pause off-screen with IntersectionObserver, `prefers-reduced-motion`, DPR cap), React component, PNG at chosen size.
- [ ] **3.5** Sources section and "report an error" link (GitHub issue template) on every lesson.
- [ ] **3.6** Cross-device check: desktop Chrome, Firefox, Safari; Android Chrome; iPhone Safari. Note issues in `docs/device-checks.md`.

**Gate 3:** every lesson of part 1 passes the e2e test and has been reviewed against its sources.

---

## Phase 4: afterwards

Parts 2 to 4 of the course (the GPU pipeline, textures, 3D, raymarching, post-processing, production), one chapter at a time. Open to contributions on GitHub: fixes, translations, new lessons.

---

## Lesson schema

`content/lessons/<chapter>/<lesson>/lesson.mdx` frontmatter:

```yaml
title: Draw a circle
idea: Use the distance from a center point to draw a circle.   # one sentence
prerequisites: [mix, uv]
estimatedMinutes: 4

starter: ./starter.glsl
solution: ./solution.glsl
passThreshold: 97            # optional, percent

editor:
  scrub: [radius, edge]      # names of declarations whose numbers are scrubbable; "all" or omit
  writableLine: null         # 1-based line number in starter.glsl, or null
  readOnly: true             # everything else locked until free-edit mode
  folded: [hash]             # shared helpers shown folded at the top

tools: [probe, handles]      # probe, handles, grid, timebar
handles: [center]            # vec2 declarations shown as draggable handles

prediction:
  question: If you raise the first smoothstep number, does the circle grow or shrink?
  choices: [It grows, It shrinks, Nothing changes]
  answer: 0

hint: The target's circle is bigger and much blurrier.
success: A circle, with no drawing function at all, just a distance.

simplifications:
  - claim: The shader runs once per pixel.
    reality: It runs per fragment; with multisampling there can be several per pixel.
    completedIn: 08-gpu/02-vertex-and-fragment

sources:
  - title: The Book of Shaders, Shapes
    url: https://thebookofshaders.com/07/
```

MDX body: the core text, then `<DeepDive question="...">` blocks where questions arise, then exactly one `<RealWorld>` block at the end.
