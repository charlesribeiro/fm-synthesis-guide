import { test, expect, type Page } from '@playwright/test';

// Observe real rendered samples. No fake context, processor, or audio responses.
async function observeAudio(page: Page) {
  await page.addInitScript(() => {
    const createAnalyser = AudioContext.prototype.createAnalyser;
    AudioContext.prototype.createAnalyser = function () {
      const analyser = createAnalyser.call(this);
      Object.assign(window, {
        readAudioPeak: () => {
          const samples = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(samples);
          return Math.max(...samples.map(Math.abs));
        },
      });
      return analyser;
    };
  });
}

async function peak(page: Page) {
  return page.evaluate(() => {
    const probe = window as Window & { readAudioPeak?: () => number };
    return probe.readAudioPeak?.() ?? 0;
  });
}

test.beforeEach(async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    // Pages intentionally returns 404 for a direct SPA document request. No asset
    // errors or runtime exceptions are exempted; pages.spec asserts this contract.
    const expectedDocument404 =
      testInfo.project.name === 'pages-chromium' &&
      message.location().url === page.url() &&
      message.text().includes('404 (Not Found)');
    if (message.type() === 'error' && !expectedDocument404) errors.push(message.text());
  });
  // Assert at teardown, including errors raised during the final interaction.
  Object.assign(page, { browserErrors: errors });
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { browserErrors: string[] }).browserErrors).toEqual([]);
});

test.describe('Release Smoke Suite', () => {
  test('navigation and routing', async ({ page }) => {
    await page.goto('./');

    await expect(page).toHaveTitle(/DX7 Algorithm Lab/i);
    await page.click('text=Algorithms');
    await expect(page).toHaveURL(/.*\/algorithms/);

    await page.click('text=Algorithm 1');
    await expect(page).toHaveURL(/.*\/algorithms\/1/);
    await expect(page.locator('h1')).toContainText('Algorithm 1');

    await page.click('text=Playground');
    await expect(page).toHaveURL(/.*\/playground/);

    await page.click('text=Learn');
    await expect(page).toHaveURL(/.*\/learn/);
  });

  test('audio enable, note lifecycle, and algorithm switching', async ({ page }) => {
    await observeAudio(page);
    // 1. Go to Lesson 32
    await page.goto('learn/algorithm-32');
    await expect(page.locator('h1')).toContainText(/Pure additive synthesis/i);

    // Initial state: Audio is disabled
    const gateButton = page.locator('.gate button');
    await expect(gateButton).toBeVisible();
    await expect(gateButton).toContainText(/Enable audio/i);

    await expect(page.locator('.key').first()).toHaveAttribute('aria-disabled', 'true');
    expect(await peak(page)).toBe(0);

    // 2. Enable audio
    await gateButton.click();
    await expect(gateButton).not.toBeVisible();

    const keyboard = page.locator('.keyboard');
    await expect(keyboard).toBeVisible();

    // The first key is C4. Wait for it to become enabled.
    const key = page.locator('.key').first();
    await expect(key).not.toHaveAttribute('aria-disabled', 'true');

    // 3. Play a note
    await key.hover();
    await page.mouse.down();
    await expect(key).toHaveClass(/key--pressed/);
    await expect.poll(() => peak(page)).toBeGreaterThan(0.001);
    await page.mouse.up();
    await expect(key).not.toHaveClass(/key--pressed/);
    await expect.poll(() => peak(page), { timeout: 10_000 }).toBeLessThan(0.0001);

    // 4. Algorithm switching: Go to Lesson 1
    await page.click('text=Back to all lessons');
    await expect(page).toHaveURL(/.*\/learn/);
    await page.click('text=A stack and a tower');
    await expect(page).toHaveURL(/.*\/learn\/algorithm-1/);
    await expect(page.locator('h1')).toContainText(/A stack and a tower/i);

    // The same audio engine remains ready after route-driven algorithm switching.
    await expect(gateButton).not.toBeVisible();
    const key1 = page.locator('.key').first();
    await expect(key1).not.toHaveAttribute('aria-disabled', 'true');
    await key1.hover();
    await page.mouse.down();
    await expect(key1).toHaveClass(/key--pressed/);
    await expect.poll(() => peak(page)).toBeGreaterThan(0.001);
    await page.mouse.up();
    await expect(key1).not.toHaveClass(/key--pressed/);
    await expect.poll(() => peak(page), { timeout: 10_000 }).toBeLessThan(0.0001);
  });
});

test('computer keyboard note release and navigation while held stop real audio', async ({
  page,
}) => {
  await observeAudio(page);
  await page.goto('learn/algorithm-32');
  await page.getByRole('button', { name: 'Enable audio', exact: true }).click();
  const key = page.locator('.key').first();
  await expect(key).toBeFocused();
  await page.keyboard.down('KeyA');
  await expect(key).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => peak(page)).toBeGreaterThan(0.001);
  await page.keyboard.up('KeyA');
  await expect(key).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => peak(page), { timeout: 10_000 }).toBeLessThan(0.0001);
  await page.keyboard.down('KeyA');
  await expect.poll(() => peak(page)).toBeGreaterThan(0.001);
  await page.getByRole('link', { name: 'Back to all lessons' }).click();
  await expect(page).toHaveURL(/\/learn$/);
  await expect.poll(() => peak(page), { timeout: 10_000 }).toBeLessThan(0.0001);
  await page.keyboard.up('KeyA');
});
