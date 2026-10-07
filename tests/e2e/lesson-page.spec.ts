import { expect, test, type Page } from '@playwright/test';
import { site } from '../../src/config/site';

// Lesson 01-pixels/01-one-color, played end to end on its real page.
const LESSON = '/learn/pixels/one-color/';

const numbers = (page: Page) => page.locator('.cm-scrub');
const meter = (page: Page) => page.getByRole('meter', { name: 'Similarity to the target' });

async function openLesson(page: Page) {
  await page.goto(LESSON);
  await expect(numbers(page)).toHaveCount(3);
}

/** Moves red, green and blue to the solution, vec3(1.00, 0.55, 0.10), with the keyboard. */
async function solve(page: Page) {
  await numbers(page).nth(0).focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press('Shift+ArrowUp');
  await numbers(page).nth(1).focus();
  await page.keyboard.press('Shift+ArrowUp');
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowUp');
  await numbers(page).nth(2).focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press('Shift+ArrowDown');
}

test('the home page leads to the first lesson', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Start with lesson 1/ }).click();
  await expect(page).toHaveURL(LESSON);
});

test('the page shows the lesson, its chapter and its place in the chapter', async ({ page }) => {
  await openLesson(page);
  await expect(page).toHaveTitle(`One color · ${site.name}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('One color');
  await expect(page.getByText('Chapter 1: One pixel, one color')).toBeVisible();
  await expect(page.getByText('A shader is a small function')).toBeVisible();
  const chapterNav = page.getByRole('navigation', { name: 'Lessons in this chapter' });
  await expect(chapterNav.getByRole('link', { name: 'Lesson 1: One color' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('the hint stays hidden until asked for', async ({ page }) => {
  await openLesson(page);
  const hint = page.getByText('The target is orange');
  await expect(hint).toBeHidden();
  await page.getByText('Show a hint').click();
  await expect(hint).toBeVisible();
  await page.getByText('Hide the hint').click();
  await expect(hint).toBeHidden();
});

test('the lesson is fully playable: probe, score, success and saved progress', async ({ page }) => {
  await openLesson(page);
  // The probe is one of this lesson's tools: values show at the end of the lines.
  await expect(page.locator('.cm-value').nth(1)).toHaveText('= 0.20');
  await expect(meter(page)).toHaveAttribute('aria-valuenow', '0');

  await solve(page);
  await expect(meter(page)).toHaveAttribute('aria-valuenow', '100');
  await expect(page.getByText('Solved! You just colored every pixel of the image.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Lesson 1: One color (solved)' })).toBeVisible();

  await page.reload();
  await expect(page.getByText('You already solved this lesson.')).toBeVisible();
});

test('Start over brings the starter code back', async ({ page }) => {
  await openLesson(page);
  await numbers(page).nth(0).focus();
  await page.keyboard.press('Shift+ArrowUp');
  await expect(numbers(page).nth(0)).toHaveText('0.30');
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(numbers(page)).toHaveText(['0.20', '0.40', '0.90']);
});

test('the page loads without console errors or failed requests', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);
  });
  await openLesson(page);
  await expect(meter(page)).toHaveAttribute('aria-valuenow', '0');
  expect(problems).toEqual([]);
});

test.describe('themes', () => {
  test.use({ colorScheme: 'dark' });

  test('the theme switch overrides the system and is remembered', async ({ page }) => {
    await openLesson(page);
    const html = page.locator('html');
    await expect(html).not.toHaveAttribute('data-theme');
    const toggle = page.getByRole('button', { name: 'Switch to the light theme' });
    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(background).toBe('rgb(238, 240, 245)');

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('button', { name: 'Switch to the dark theme' })).toBeVisible();
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('one column: text, then image, then code, without sideways scrolling', async ({ page }) => {
    await openLesson(page);
    const top = async (selector: string) => (await page.locator(selector).boundingBox())!.y;
    const text = await top('article h1');
    const image = await top('canvas[aria-label="Your image"]');
    const code = await top('.cm-editor');
    expect(text).toBeLessThan(image);
    expect(image).toBeLessThan(code);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the text and the code are still readable', async ({ page }) => {
    await page.goto(LESSON);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('One color');
    await expect(page.locator('pre')).toContainText('float red = 0.20;');
  });
});
