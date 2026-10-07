import { expect, test } from '@playwright/test';
import { openEngine, pixelDistance, toByte, type EngineWindow } from './engine';

const UNDECLARED_ON_LINE_3 = `vec3 color(vec2 uv) {
  float a = 1.0;
  return vec3(undeclaredThing);
}`;

test('assembled lesson code compiles, draws, and clamps the output', async ({ page }) => {
  await openEngine(page);
  const pixel = await page.evaluate(() => {
    const { gl, assemble } = (window as unknown as EngineWindow).engine;
    const renderer = gl.Renderer.create(document.createElement('canvas'))!;
    // Red above 1 and blue below 0 must come out as 1 and 0.
    const shader = assemble.assemble('vec3 color(vec2 uv) {\n  return vec3(2.0, uv.y, -1.0);\n}');
    const result = renderer.compile(shader.source);
    if (!result.ok) throw new Error(result.log);
    const target = renderer.createTarget(2, 2);
    const uniforms = { [assemble.UNIFORMS.resolution]: [2, 2], [assemble.UNIFORMS.time]: 0 };
    renderer.draw(result.program, { target, uniforms });
    // Top-left pixel: its center is at uv (0.25, 0.75).
    const bytes = Array.from(renderer.readPixels({ target, x: 0, y: 1, width: 1, height: 1 }));
    renderer.dispose();
    return bytes;
  });

  expect(pixelDistance(pixel, [255, toByte(0.75), 0, 255])).toBeLessThanOrEqual(1);
});

for (const withHelpers of [false, true]) {
  test(`an undeclared identifier on line 3 is reported on line 3${withHelpers ? ', with helpers' : ''}`, async ({
    page,
  }) => {
    await openEngine(page);
    const errors = await page.evaluate(
      ([code, withHelpers]) => {
        const { gl, assemble } = (window as unknown as EngineWindow).engine;
        const renderer = gl.Renderer.create(document.createElement('canvas'))!;
        const helpers = withHelpers
          ? ['float helperA() {\n  return 1.0;\n}', 'float helperB() {\n  return 2.0;\n}']
          : [];
        const shader = assemble.assemble(code, { helpers });
        const result = renderer.compile(shader.source);
        renderer.dispose();
        if (result.ok) throw new Error('The shader was expected to fail');
        return assemble.parseCompileLog(result.log, shader);
      },
      [UNDECLARED_ON_LINE_3, withHelpers] as const,
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ line: 3, part: 'code' });
    expect(errors[0].message).toContain('undeclaredThing');
  });
}
