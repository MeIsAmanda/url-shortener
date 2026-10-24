import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import App from './App.jsx';
import { HISTORY_KEY } from './snipHistory.js';

const user = { id: 1, name: 'Amanda', email: 'amanda@example.com' };
const originalUrl = 'https://example.com/a?x=%2F#Section';
const shortUrl = 'http://localhost:8080/s/new';
const link = { code: 'new', shortUrl, originalUrl, createdAt: '2026-10-25T10:30:00Z', clickCount: 3 };
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

function setup({ initialUser = user, items = [link], failCreation = false, delayLinks = false } = {}) {
  const state = { user: initialUser, items, clicks: 3, calls: [], delayed: null };
  vi.stubGlobal('fetch', vi.fn(async (path, options = {}) => {
    state.calls.push({ path, options });
    if (path === '/api/auth/session') return response({ user: state.user, googleSignInEnabled: true, csrfToken: 'session-token' });
    if (path.startsWith('/api/account/links')) {
      if (delayLinks) return new Promise(resolve => { state.delayed = resolve; });
      if (path.includes('before=')) return response({ items: [{ ...link, code: 'old', shortUrl: 'http://localhost:8080/s/old' }], nextCursor: null });
      return response({ items: state.items.map(item => ({ ...item, clickCount: state.clicks })), nextCursor: state.items.length ? '20' : null });
    }
    if (path === '/api/auth/logout') { state.user = null; return response(null, 204); }
    if (path === '/api/urls') {
      if (failCreation) { state.user = null; return response(null, 401); }
      state.items = [link];
      return response({ originalUrl, shortUrl }, 201);
    }
    throw new Error('Unexpected path: ' + path);
  }));
  const keyboard = userEvent.setup();
  render(<App />);
  return { keyboard, state };
}

it('offers Google sign-in to guests and keeps browser recent snips', async () => {
  setup({ initialUser: null });
  expect(await screen.findByRole('link', { name: 'Sign in with Google' })).toHaveAttribute('href', '/oauth2/authorization/google');
  expect(screen.getByRole('complementary', { name: 'Recent snips' })).toBeVisible();
  expect(screen.queryByRole('complementary', { name: 'My links' })).not.toBeInTheDocument();
});

it('shows account creation dates/clicks, refreshes counts, and loads older pages', async () => {
  const { keyboard, state } = setup();
  const panel = await screen.findByRole('complementary', { name: 'My links' });
  expect(await within(panel).findByText('3 clicks')).toBeVisible();
  expect(within(panel).getByText(/Created .*2026/)).toBeVisible();
  state.clicks = 7;
  await keyboard.click(within(panel).getByRole('button', { name: 'Refresh' }));
  expect(await within(panel).findByText('7 clicks')).toBeVisible();
  await keyboard.click(within(panel).getByRole('button', { name: 'Load older links' }));
  expect(await within(panel).findByRole('link', { name: 'Open account link http://localhost:8080/s/old' })).toBeVisible();
});

it('sends signed-in creation with CSRF and does not put account links in guest storage', async () => {
  const { keyboard, state } = setup({ items: [] });
  await screen.findByRole('complementary', { name: 'My links' });
  await keyboard.type(screen.getByRole('textbox'), originalUrl);
  await keyboard.click(screen.getByRole('button', { name: 'Snip my link' }));
  expect(await screen.findByRole('link', { name: 'Open link', exact: true })).toHaveAttribute('href', shortUrl);
  expect(state.calls.find(call => call.path === '/api/urls').options.headers).toMatchObject({
    'X-CSRF-TOKEN': 'session-token', 'X-Sniply-Account': 'true',
  });
  expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
  expect(await within(screen.getByRole('complementary', { name: 'My links' })).findByRole('link', { name: 'Open account link ' + shortUrl })).toBeVisible();
});

it('logs out, removes private account UI, and restores separate guest history', async () => {
  const guest = { shortUrl: 'http://localhost:8080/s/guest', originalUrl, createdAt: link.createdAt };
  localStorage.setItem(HISTORY_KEY, JSON.stringify([guest]));
  const { keyboard, state } = setup();
  await screen.findByRole('complementary', { name: 'My links' });
  await keyboard.click(screen.getByRole('button', { name: 'Sign out', exact: true }));
  const recent = await screen.findByRole('complementary', { name: 'Recent snips' });
  expect(within(recent).getByRole('link', { name: 'Open saved snip ' + guest.shortUrl })).toBeVisible();
  expect(screen.queryByRole('complementary', { name: 'My links' })).not.toBeInTheDocument();
  expect(state.calls.find(call => call.path === '/api/auth/logout').options.headers).toEqual({ 'X-CSRF-TOKEN': 'session-token' });
});

it('does not restore private links from a response arriving after logout', async () => {
  const { keyboard, state } = setup({ delayLinks: true });
  await screen.findByRole('complementary', { name: 'My links' });
  await keyboard.click(screen.getByRole('button', { name: 'Sign out', exact: true }));
  await screen.findByRole('complementary', { name: 'Recent snips' });
  await act(async () => state.delayed(response({ items: [link], nextCursor: null })));
  expect(screen.queryByRole('link', { name: 'Open account link ' + shortUrl })).not.toBeInTheDocument();
});

it('handles an expired account session without pretending an anonymous creation succeeded', async () => {
  const { keyboard } = setup({ failCreation: true });
  await screen.findByRole('complementary', { name: 'My links' });
  await keyboard.type(screen.getByRole('textbox'), originalUrl);
  await keyboard.click(screen.getByRole('button', { name: 'Snip my link' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('session changed');
  await screen.findByRole('complementary', { name: 'Recent snips' });
  expect(screen.queryByRole('link', { name: 'Open link', exact: true })).not.toBeInTheDocument();
  expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
});

it('rechecks identity on focus before showing another account’s links', async () => {
  const { state } = setup();
  const initial = await screen.findByRole('complementary', { name: 'My links' });
  await within(initial).findByText('3 clicks');
  state.user = { id: 2, name: 'Bob', email: 'bob@example.com' };
  state.items = [{ ...link, code: 'bob', shortUrl: 'http://localhost:8080/s/bob' }];
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(await screen.findByText('Hi, Bob')).toBeVisible();
  const next = await screen.findByRole('complementary', { name: 'My links' });
  expect(await within(next).findByRole('link', { name: 'Open account link http://localhost:8080/s/bob' })).toBeVisible();
  expect(screen.queryByRole('link', { name: 'Open account link ' + shortUrl })).not.toBeInTheDocument();
});

it('does not expose a late creation result after signing out', async () => {
  const { keyboard } = setup({ items: [] });
  await screen.findByRole('complementary', { name: 'My links' });
  const originalFetch = fetch.getMockImplementation();
  let finish;
  fetch.mockImplementation((path, options) => path === '/api/urls'
    ? new Promise(resolve => { finish = resolve; }) : originalFetch(path, options));
  await keyboard.type(screen.getByRole('textbox'), originalUrl);
  await keyboard.click(screen.getByRole('button', { name: 'Snip my link' }));
  await keyboard.click(screen.getByRole('button', { name: 'Sign out', exact: true }));
  await screen.findByRole('complementary', { name: 'Recent snips' });
  await act(async () => finish(response({ originalUrl, shortUrl }, 201)));
  expect(screen.queryByRole('link', { name: 'Open link', exact: true })).not.toBeInTheDocument();
  expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
});
