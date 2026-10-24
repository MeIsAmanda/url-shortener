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

for (const width of [360, 390, 768, 1280]) {
  test(`creates a link without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockSuccess(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByRole('textbox', { name: 'Your long URL' }).fill(originalUrl);
    await page.getByRole('textbox', { name: 'Your long URL' }).press('Enter');
    await expect(page.getByRole('link', { name: 'Open link' })).toHaveAttribute('href', shortUrl);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByText(originalUrl, { exact: true })).toBeVisible();
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
  await page.getByRole('button', { name: 'Shorten my link' }).click();
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByText(/copy it manually/)).toBeVisible();
});
