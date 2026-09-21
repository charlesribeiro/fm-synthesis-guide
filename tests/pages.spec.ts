import { test, expect } from '@playwright/test';

test('Pages deep link and reload retain route, base path and working audio', async ({
  page,
  request,
}) => {
  const response = await page.goto('learn/algorithm-32?source=bookmark');
  expect(response?.status()).toBe(404); // GitHub Pages custom 404 shell, not a rewrite.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pure additive synthesis');
  expect(await page.evaluate(() => new URL(document.baseURI).pathname)).toBe(
    '/fm-synthesis-guide/',
  );
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pure additive synthesis');
  // Chromium does not emit page response events for AudioWorklet module fetches.
  // Check serving independently; real initialization below proves addModule succeeded.
  await page.getByRole('button', { name: 'Enable audio', exact: true }).click();
  const resource = await request.get('worklets/dx7-worklet-processor.js');
  expect(new URL(resource.url()).pathname).toBe(
    '/fm-synthesis-guide/worklets/dx7-worklet-processor.js',
  );
  expect(resource.status()).toBe(200);
  expect(resource.headers()['content-type']).toContain('javascript');
  await expect(page.locator('.key').first()).not.toHaveAttribute('aria-disabled', 'true');
});

test('Pages publishes architecture and methodology alongside the production app', async ({
  request,
}) => {
  for (const name of ['ARCHITECTURE.md', 'RELEASE.md']) {
    const response = await request.get(`docs/${name}`);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('# ');
  }
  const misplacedWorklet = await request.get('/worklets/dx7-worklet-processor.js');
  expect(misplacedWorklet.status()).toBe(404);
});
