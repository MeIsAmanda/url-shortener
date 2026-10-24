import { expect, test } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', route => route.fulfill({
    status: 200, json: { user: null, googleSignInEnabled: false, csrfToken: 'guest-token' },
  }));
});

for (const width of [320, 390, 768, 1024, 1280]) {
  test('keeps recent snips across reloads and places them responsively at ' + width, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width, height: 900 });
    let requests = 0;
    await page.route('**/api/urls', async route => {
      requests++;
      const { originalUrl } = route.request().postDataJSON();
      await route.fulfill({ status: 201, json: { originalUrl, shortUrl: 'http://localhost:8080/s/saved' + requests } });
    });
    await page.goto('/');
    const history = page.getByRole('complementary', { name: 'Recent snips' });
    const input = page.getByRole('textbox', { name: 'Put your long URL here!' });
    for (const originalUrl of ['example.com/first', 'https://example.com/' + 'long-path-'.repeat(30) + '?x=%2F#Section']) {
      await input.fill(originalUrl);
      await page.getByRole('button', { name: 'Snip my link' }).click();
      await expect(history.getByRole('listitem')).toHaveCount(requests);
    }
    await expect(history.locator('.saved-short-url').first()).toHaveAttribute('href', 'http://localhost:8080/s/saved2');
    const tool = await page.getByRole('region', { name: 'Link shortener' }).boundingBox();
    const collection = await history.boundingBox();
    if (width >= 1000) {
      expect(collection.x).toBeGreaterThanOrEqual(tool.x + tool.width);
      expect(Math.abs(collection.y - tool.y)).toBeLessThan(2);
    } else {
      expect(collection.y).toBeGreaterThanOrEqual(tool.y + tool.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.reload();
    await expect(history.getByRole('listitem')).toHaveCount(2);
    expect(requests).toBe(2);
    const latest = 'http://localhost:8080/s/saved2';
    await history.getByRole('button', { name: 'Copy saved snip ' + latest }).click();
    await expect(history.getByRole('button', { name: 'Copy saved snip ' + latest })).toHaveText('Copied!');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(latest);
    await history.getByRole('button', { name: 'Remove saved snip ' + latest }).click();
    await expect(history.getByRole('listitem')).toHaveCount(1);
    await history.getByRole('button', { name: 'Clear history' }).click();
    await page.reload();
    await expect(history.getByRole('listitem')).toHaveCount(0);
    expect(requests).toBe(2);
  });
}

for (const [width, height] of [[1000, 700], [1024, 768], [1280, 720], [1280, 900], [1920, 1080]]) {
  test('scrolls only recent snips with a full collection at ' + width + 'x' + height, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('sniply.recent-snips.v1', JSON.stringify(
      Array.from({ length: 20 }, (_, index) => ({
        originalUrl: 'https://example.com/a-long-destination?x=%2F#Section',
        shortUrl: 'http://localhost:8080/s/saved' + index,
        createdAt: new Date().toISOString(),
      }))
    )));
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    const dimensions = () => page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      width: document.documentElement.scrollWidth,
      scrollTop: document.scrollingElement.scrollTop,
    }));
    expect((await dimensions()).height).toBeLessThanOrEqual(height + 1);
    expect((await dimensions()).width).toBeLessThanOrEqual(width);
    const list = page.locator('.history-list');
    expect(await list.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
    await list.hover();
    await page.mouse.wheel(0, 600);
    await expect.poll(() => list.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    expect((await dimensions()).scrollTop).toBe(0);
    await page.route('**/api/urls', route => route.fulfill({
      status: 201,
      json: { originalUrl: 'https://example.com/new', shortUrl: 'http://localhost:8080/s/new' },
    }));
    await page.getByRole('textbox').fill('example.com/new');
    await page.getByRole('button', { name: 'Snip my link' }).click();
    const open = page.getByRole('link', { name: 'Open link', exact: true });
    await expect(open).toBeVisible();
    expect((await dimensions()).height).toBeLessThanOrEqual(height + 1);
    const resultBox = await open.boundingBox();
    expect(resultBox.y + resultBox.height).toBeLessThanOrEqual(height);
    await list.evaluate(node => { node.scrollTop = node.scrollHeight; });
    await list.hover();
    await page.mouse.wheel(0, 800);
    expect((await dimensions()).scrollTop).toBe(0);
  });
}

test('storage quota failures do not turn successful shortening into an error', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
  });
  const shortUrl = 'http://localhost:8080/s/stillworks';
  await page.route('**/api/urls', route => route.fulfill({
    status: 201, json: { originalUrl: 'https://example.com/', shortUrl },
  }));
  await page.goto('/');
  await page.getByRole('textbox').fill('example.com');
  await page.getByRole('button', { name: 'Snip my link' }).click();
  await expect(page.getByRole('link', { name: 'Open link' })).toHaveAttribute('href', shortUrl);
  const history = page.getByRole('complementary', { name: 'Recent snips' });
  await expect(history.getByRole('link', { name: 'Open saved snip ' + shortUrl })).toBeVisible();
  await expect(history.getByText(/Browser storage is unavailable/)).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
