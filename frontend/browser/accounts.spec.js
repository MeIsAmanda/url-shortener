import { expect, test } from '@playwright/test';

for (const width of [320, 1280]) {
  test('shows private account links, dates, clicks, refresh and logout at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let signedIn = true;
    let clicks = 4;
    let created = false;
    const saved = { code: 'mine', shortUrl: 'http://localhost:8080/s/mine', originalUrl: 'https://example.com/my-link', createdAt: '2026-10-25T10:00:00Z', clickCount: clicks };
    await page.route('**/api/auth/session', route => route.fulfill({
      status: 200, json: { user: signedIn ? { id: 1, name: 'Amanda', email: 'amanda@example.com' } : null, googleSignInEnabled: true, csrfToken: 'csrf' },
    }));
    await page.route('**/api/account/links*', route => route.fulfill({
      status: 200, json: { items: [{ ...saved, clickCount: clicks }], nextCursor: null },
    }));
    await page.route('**/api/urls', async route => {
      expect(route.request().headers()['x-csrf-token']).toBe('csrf');
      expect(route.request().headers()['x-sniply-account']).toBe('true');
      created = true;
      await route.fulfill({ status: 201, json: { originalUrl: saved.originalUrl, shortUrl: saved.shortUrl } });
    });
    await page.route('**/api/auth/logout', async route => {
      expect(route.request().method()).toBe('POST');
      expect(route.request().headers()['x-csrf-token']).toBe('csrf');
      signedIn = false;
      await route.fulfill({ status: 204 });
    });
    await page.goto('/');
    const panel = page.getByRole('complementary', { name: 'My links' });
    await expect(panel.getByText('4 clicks')).toBeVisible();
    await expect(panel.getByText(/Created .*2026/)).toBeVisible();
    clicks = 5;
    await panel.getByRole('button', { name: 'Refresh' }).click();
    await expect(panel.getByText('5 clicks')).toBeVisible();
    await page.getByRole('textbox').fill('example.com/my-link');
    await page.getByRole('button', { name: 'Snip my link' }).click();
    await expect(page.getByRole('link', { name: 'Open link', exact: true })).toBeVisible();
    expect(created).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('sniply.recent-snips.v1'))).toBeNull();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Recent snips' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in with Google' })).toHaveAttribute('href', '/oauth2/authorization/google');
    await expect(panel).toHaveCount(0);
  });
}

test('shows an unavailable Google button when credentials are not configured', async ({ page }) => {
  await page.route('**/api/auth/session', route => route.fulfill({
    status: 200, json: { user: null, googleSignInEnabled: false, csrfToken: 'csrf' },
  }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Snip my link' })).toBeEnabled();
});
