import { expect, test } from '@playwright/test';

const originalUrl = `https://example.com/${'a-long-destination-'.repeat(12)}?campaign=demo&x=1#section`;
const shortUrl = 'http://localhost:8080/s/Abc1234';

// These browser tests deliberately stub the API: they verify frontend behavior
// and layout. The backend integration suite verifies actual storage/redirects.
async function mockSuccess(page) {
  await page.route('**/api/urls', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({ originalUrl });
    await route.fulfill({ status: 201, json: { originalUrl, shortUrl } });
  });
}

for (const [width, height] of [[320, 780], [360, 900], [390, 900], [768, 900], [1280, 900], [844, 390]]) {
  test(`creates a link without horizontal overflow at ${width}×${height}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await mockSuccess(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByRole('textbox', { name: 'Your long URL' }).fill(originalUrl);
    await page.getByRole('textbox', { name: 'Your long URL' }).press('Enter');
    await expect(page.getByRole('link', { name: 'Open link' })).toHaveAttribute('href', shortUrl);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByText('Original link', { exact: true }).click();
    await expect(page.getByText(originalUrl, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('supports keyboard navigation and submits empty input unchanged', async ({ page }) => {
  await page.route('**/api/urls', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ originalUrl: '' });
    await route.fulfill({ status: 201, json: { originalUrl: '', shortUrl } });
  });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  const input = page.getByRole('textbox', { name: 'Your long URL' });
  await input.focus();
  await input.press('Enter');
  await expect(page.getByRole('link', { name: 'Open link' })).toHaveAttribute('href', shortUrl);
});

test('shows clipboard guidance when the browser denies access', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async () => { throw new Error('Permission denied'); } },
  }));
  await mockSuccess(page);
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Your long URL' }).fill(originalUrl);
  await page.getByRole('button', { name: 'Snip my link' }).click();
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByText(/copy it manually/)).toBeVisible();
});

test('plays and replays the snip without making a fast API result wait', async ({ page }) => {
  await mockSuccess(page);
  await page.goto('/');
  const scene = page.getByTestId('cutting-scene');
  const initialScene = await scene.elementHandle();
  await page.getByRole('textbox', { name: 'Your long URL' }).fill(originalUrl);
  await page.getByRole('button', { name: 'Snip my link' }).click();
  await expect(page.getByRole('link', { name: 'Open link' })).toBeVisible();
  // The result is already usable while the independent 1.1-second snip plays.
  expect(await scene.evaluate((svg) => svg.getAnimations({ subtree: true }).some((animation) => animation.playState === 'running'))).toBe(true);
  expect(await initialScene.evaluate((svg) => svg.isConnected)).toBe(false);

  const previousScene = await scene.elementHandle();
  await page.getByRole('button', { name: 'Snip my link' }).click();
  await expect(page.getByRole('link', { name: 'Open link' })).toBeVisible();
  expect(await previousScene.evaluate((svg) => svg.isConnected)).toBe(false);
});

test('keeps the result usable with reduced motion and no decorative animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockSuccess(page);
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Your long URL' }).fill(originalUrl);
  await page.getByRole('button', { name: 'Snip my link' }).click();
  await expect(page.getByRole('link', { name: 'Open link' })).toBeVisible();
  expect(await page.getByTestId('cutting-scene').evaluate((svg) => svg.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running').length)).toBe(0);
});
