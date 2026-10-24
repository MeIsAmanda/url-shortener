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
    await expect(page).toHaveTitle('Sniply — Small links, ready to share');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('the little link studio', { exact: true })).toHaveCount(0);
    const inputBox = await page.getByRole('textbox', { name: 'Put your long URL here!' }).boundingBox();
    const confettiBox = await page.locator('.scene-confetti').boundingBox();
    expect(confettiBox.y).toBeGreaterThan(inputBox.y + inputBox.height);
    await page.getByRole('textbox', { name: 'Put your long URL here!' }).click();
    await expect(page.getByRole('textbox', { name: 'Put your long URL here!' })).toBeFocused();
    await page.getByRole('textbox', { name: 'Put your long URL here!' }).fill(originalUrl);
    await page.getByRole('textbox', { name: 'Put your long URL here!' }).press('Enter');
    await expect(page.getByRole('link', { name: 'Open link' })).toHaveAttribute('href', shortUrl);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByText('Original link', { exact: true }).click();
    await expect(page.getByRole('region', { name: 'Freshly snipped!' }).getByText(originalUrl, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('supports keyboard validation and correction without a request for invalid input', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/urls', async (route) => {
    requests++;
    expect(route.request().postDataJSON()).toEqual({ originalUrl });
    await route.fulfill({ status: 201, json: { originalUrl, shortUrl } });
  });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  const input = page.getByRole('textbox', { name: 'Put your long URL here!' });
  await input.focus();
  await input.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Enter a URL');
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(requests).toBe(0);
  await input.fill(originalUrl);
  await input.press('Enter');
  await expect(page.getByRole('link', { name: 'Open link' })).toHaveAttribute('href', shortUrl);
  expect(requests).toBe(1);
});

for (const [index, [value, message]] of [
  ['ftp://example.com', 'Include http:// or https://'],
  ['https://example.notarealtld', 'recognized ending'],
  ['https://example.com/?q=%ZZ', 'correctly encoded'],
  ['https://example.com/a b', 'correctly encoded'],
  ['https://example.com/' + 'a'.repeat(2048), '2,048'],
].entries()) {
  test('shows destination validation ' + index + ': ' + message, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    let requests = 0;
    await page.route('**/api/urls', () => { requests++; });
    await page.goto('/');
    const input = page.getByRole('textbox', { name: 'Put your long URL here!' });
    await input.fill(value);
    await page.getByRole('button', { name: 'Snip my link' }).click();
    await expect(page.getByRole('alert')).toContainText(message);
    await expect(input).toHaveValue(value);
    await expect(input).toBeFocused();
    expect(requests).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

for (const [index, [typed, completed, width, enter]] of [
  ['example.com/a?x=%2F#Section', 'https://example.com/a?x=%2F#Section', 320, false],
  ['example.com:8443/a', 'https://example.com:8443/a', 1280, true],
  ['http://example.com/a', 'http://example.com/a', 390, false],
  ['//example.com/a', 'https://example.com/a', 390, true],
].entries()) {
  test('shows and submits the completed protocol ' + index, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/urls', async route => {
      expect(route.request().postDataJSON()).toEqual({ originalUrl: completed });
      await route.fulfill({ status: 201, json: { originalUrl: completed, shortUrl } });
    });
    await page.goto('/');
    const input = page.getByRole('textbox', { name: 'Put your long URL here!' });
    await input.fill(typed);
    await expect(input).toHaveValue(completed);
    if (enter) await input.press('Enter');
    else await page.getByRole('button', { name: 'Snip my link' }).click();
    await expect(page.getByRole('link', { name: 'Open link' })).toBeVisible();
    await expect(input).toHaveValue(completed);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}

for (const width of [320, 1280]) {
  test('completes real keyboard entry without moving the caret or blocking edits at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const input = page.getByRole('textbox', { name: 'Put your long URL here!' });
    await input.click();
    await input.pressSequentially('example');
    await expect(input).toHaveValue('example');
    await input.press('.');
    await expect(input).toHaveValue('https://example.');
    expect(await input.evaluate(field => field.selectionStart)).toBe('https://example.'.length);
    await input.pressSequentially('com/a?x=%2F#Section');
    await expect(input).toHaveValue('https://example.com/a?x=%2F#Section');
    expect(await input.evaluate(field => field.selectionStart)).toBe('https://example.com/a?x=%2F#Section'.length);
    // Replacing the value with its equivalent bare address may leave React's
    // state unchanged. A subsequent middle edit must still retain its caret.
    await input.fill('example.com/a?x=%2F#Section');
    await expect(input).toHaveValue('https://example.com/a?x=%2F#Section');
    await input.evaluate(field => field.setSelectionRange(15, 15));
    await input.pressSequentially('-new');
    await expect(input).toHaveValue('https://example-new.com/a?x=%2F#Section');
    expect(await input.evaluate(field => field.selectionStart)).toBe(19);
    await input.fill('https://example.com/a?x=%2F#Section');
    await input.evaluate(field => field.setSelectionRange(0, 8));
    await input.press('Backspace');
    await expect(input).toHaveValue('example.com/a?x=%2F#Section');
    await input.pressSequentially('http://');
    await expect(input).toHaveValue('http://example.com/a?x=%2F#Section');
    await input.press('ControlOrMeta+a');
    await input.press('Backspace');
    await expect(input).toHaveValue('');
    await input.pressSequentially('https://example.com');
    await expect(input).toHaveValue('https://example.com');
  });
}

test('shows clipboard guidance when the browser denies access', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async () => { throw new Error('Permission denied'); } },
  }));
  await mockSuccess(page);
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Put your long URL here!' }).fill(originalUrl);
  await page.getByRole('button', { name: 'Snip my link' }).click();
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByText(/copy it manually/)).toBeVisible();
});

test('plays and replays the snip without making a fast API result wait', async ({ page }) => {
  await mockSuccess(page);
  await page.goto('/');
  const scene = page.getByTestId('cutting-scene');
  const initialScene = await scene.elementHandle();
  await page.getByRole('textbox', { name: 'Put your long URL here!' }).fill(originalUrl);
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
  await page.getByRole('textbox', { name: 'Put your long URL here!' }).fill(originalUrl);
  await page.getByRole('button', { name: 'Snip my link' }).click();
  await expect(page.getByRole('link', { name: 'Open link' })).toBeVisible();
  expect(await page.getByTestId('cutting-scene').evaluate((svg) => svg.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running').length)).toBe(0);
});

test('cuts the actual editable field and restores it immediately when editing resumes', async ({ page }) => {
  await mockSuccess(page);
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Put your long URL here!' });
  const originalNode = await input.elementHandle();
  const fieldBox = await input.boundingBox();
  const sceneBox = await page.getByTestId('cutting-scene').boundingBox();
  expect(fieldBox.y).toBeGreaterThan(sceneBox.y);
  expect(fieldBox.y + fieldBox.height).toBeLessThan(sceneBox.y + sceneBox.height / 2);
  await input.fill(originalUrl);
  await page.getByRole('button', { name: 'Snip my link' }).click();
  await expect(page.getByRole('link', { name: 'Open link' })).toBeVisible();
  // A very fast response must not leave the animated field blocking editing.
  await input.click();
  await input.fill('changed destination');
  await expect(input).toHaveValue('changed destination');
  await expect(page.getByRole('link', { name: 'Open link' })).toHaveCount(0);
  expect(await originalNode.evaluate((node) => node.isConnected)).toBe(true);
  expect(await input.evaluate((node) => getComputedStyle(node.parentElement).opacity)).toBe('1');
});
