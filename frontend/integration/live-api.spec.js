import { expect, test } from '@playwright/test';
import path from 'node:path';

test('creates, copies, and resolves a real saved link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.goto('/');
  if (process.env.CAPTURE_SCREENSHOTS) {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.resolve('../docs/screenshots/landing-desktop.png'), fullPage: true, animations: 'disabled' });
  }

  const originalUrl = 'https://example.com/a-long-path-for-the-live-frontend-check?campaign=assessment&x=1#section';
  await page.getByRole('textbox', { name: 'Your long URL' }).fill(originalUrl);
  await page.getByRole('button', { name: 'Snip my link' }).click();
  const open = page.getByRole('link', { name: 'Open link' });
  await expect(open).toBeVisible();
  const shortUrl = await open.getAttribute('href');

  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(shortUrl);

  // Use the local proxy and never follow the redirect to the third-party URL.
  const redirect = await page.request.get(new URL(shortUrl).pathname, { maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  expect(redirect.headers().location).toBe(originalUrl);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (process.env.CAPTURE_SCREENSHOTS) {
    await page.screenshot({ path: path.resolve('../docs/screenshots/result-mobile.png'), fullPage: true, animations: 'disabled' });
  }
});

test('saves a short destination even when the generated link is longer', async ({ page }) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Your long URL' });
  await input.fill('https://x.co');
  await page.getByRole('button', { name: 'Snip my link' }).click();
  const open = page.getByRole('link', { name: 'Open link' });
  await expect(open).toBeVisible();
  expect((await open.getAttribute('href')).length).toBeGreaterThan('https://x.co'.length);
  await expect(input).toHaveValue('https://x.co');
});
