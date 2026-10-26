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
  await page.getByRole('textbox', { name: 'Put your long URL here!' }).fill(originalUrl);
  await page.getByRole('button', { name: 'Snip my link' }).click();
  const open = page.getByRole('link', { name: 'Open link' });
  await expect(open).toBeVisible();
  const shortUrl = await open.getAttribute('href');

  if (process.env.CAPTURE_SCREENSHOTS) {
    // A deterministic mid-cut preview of the real field; normal test runs do
    // not pause or otherwise change the animation.
    await page.locator('.scene-frame').evaluate((frame) => {
      for (const animation of frame.getAnimations({ subtree: true })) {
        animation.pause();
        animation.currentTime = 550;
      }
    });
    await page.screenshot({ path: path.resolve('../docs/screenshots/input-cutting-desktop.png'), fullPage: true });
    await page.locator('.scene-frame').evaluate((frame) => {
      for (const animation of frame.getAnimations({ subtree: true })) animation.finish();
    });
  }

  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(shortUrl);

  // Use the local proxy and never follow the redirect to the third-party URL.
  const redirect = await page.request.get(new URL(shortUrl).pathname, { maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  expect(redirect.headers().location).toBe(originalUrl);

  const history = page.getByRole('complementary', { name: 'Recent snips' });
  await expect(history.getByRole('link', { name: 'Open saved snip ' + shortUrl })).toBeVisible();
  if (process.env.CAPTURE_SCREENSHOTS) {
    await page.screenshot({ path: path.resolve('../docs/screenshots/history-desktop.png'), fullPage: true, animations: 'disabled' });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (process.env.CAPTURE_SCREENSHOTS) {
    await page.screenshot({ path: path.resolve('../docs/screenshots/result-mobile.png'), fullPage: true, animations: 'disabled' });
  }
  await page.reload();
  await expect(history.getByRole('link', { name: 'Open saved snip ' + shortUrl })).toBeVisible();
  await history.getByRole('button', { name: 'Clear history' }).click();
  await expect(history.getByRole('listitem')).toHaveCount(0);
  const afterClear = await page.request.get(new URL(shortUrl).pathname, { maxRedirects: 0 });
  expect(afterClear.status()).toBe(302);
  expect(afterClear.headers().location).toBe(originalUrl);
});

test('saves a short destination even when the generated link is longer', async ({ page }) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Put your long URL here!' });
  await input.fill('https://x.co');
  await page.getByRole('button', { name: 'Snip my link' }).click();
  const open = page.getByRole('link', { name: 'Open link' });
  await expect(open).toBeVisible();
  expect((await open.getAttribute('href')).length).toBeGreaterThan('https://x.co'.length);
  await expect(input).toHaveValue('');
});

test('corrects a validation error then preserves encoded input through a real redirect', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Put your long URL here!' });
  await input.fill('example.com/?q=two words');
  await page.getByRole('button', { name: 'Snip my link' }).click();
  await expect(page.getByRole('alert')).toContainText('correctly encoded');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  if (process.env.CAPTURE_SCREENSHOTS) {
    await page.screenshot({ path: path.resolve('../docs/screenshots/validation-mobile.png'), fullPage: true });
  }
  const originalUrl = 'https://Example.COM/a%20b?q=two+words&x=%2F&x=2#Section';
  await input.fill(originalUrl.slice('https://'.length));
  await page.getByRole('button', { name: 'Snip my link' }).click();
  await expect(input).toHaveValue('');
  const shortUrl = await page.getByRole('link', { name: 'Open link' }).getAttribute('href');
  const response = await page.request.get(new URL(shortUrl).pathname, { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe(originalUrl);
  // Exercise the server directly as well: browser validation cannot be trusted.
  const rejected = await page.request.post('/api/urls', { data: { originalUrl: 'https://example.com/?q=%ZZ' } });
  expect(rejected.status()).toBe(400);
  expect((await rejected.json()).code).toBe('INVALID_URL');
});

test('real session endpoints protect account history and expired-account creation', async ({ page }) => {
  await page.goto('/');
  const session = await page.request.get('/api/auth/session');
  expect(session.status()).toBe(200);
  expect(session.headers()['cache-control']).toBe('no-store');
  const state = await session.json();
  expect(state.user).toBeNull();
  expect(typeof state.csrfToken).toBe('string');
  expect(typeof state.googleSignInEnabled).toBe('boolean');
  const privateLinks = await page.request.get('/api/account/links');
  expect(privateLinks.status()).toBe(401);
  const creation = await page.request.post('/api/urls', {
    headers: { 'X-Sniply-Account': 'true' },
    data: { originalUrl: 'https://example.com/should-not-be-anonymous' },
  });
  expect(creation.status()).toBe(401);
  const logout = await page.request.post('/api/auth/logout');
  expect(logout.status()).toBe(403);
});
