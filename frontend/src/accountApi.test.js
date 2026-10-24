import { beforeEach, expect, it, vi } from 'vitest';
import { fetchAccountLinks, fetchSession, signOut } from './accountApi.js';

const link = { code: '1', shortUrl: 'http://localhost:8080/s/1', originalUrl: 'https://example.com/', createdAt: '2026-10-25T00:00:00Z', clickCount: 3 };
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

it('loads the session without caching and keeps cookies same-origin', async () => {
  const data = { user: null, googleSignInEnabled: false, csrfToken: 'token' };
  fetch.mockResolvedValue(response(data));
  expect(await fetchSession()).toEqual(data);
  expect(fetch).toHaveBeenCalledWith('/api/auth/session', expect.objectContaining({ cache: 'no-store', credentials: 'same-origin' }));
});
it('rejects a malformed session rather than trusting a browser identity', async () => {
  fetch.mockResolvedValue(response({ user: { id: 'untrusted' }, googleSignInEnabled: true }));
  await expect(fetchSession()).rejects.toThrow('sign-in status');
});
it('logs out using POST with the session CSRF token', async () => {
  fetch.mockResolvedValue(response(null, 204));
  await signOut('token');
  expect(fetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST', headers: { 'X-CSRF-TOKEN': 'token' } }));
});
it('loads cursor pages with creation dates and click counts', async () => {
  fetch.mockResolvedValue(response({ items: [link], nextCursor: null }));
  expect((await fetchAccountLinks(42)).items).toEqual([link]);
  expect(fetch.mock.calls[0][0]).toBe('/api/account/links?before=42');
});
it('preserves a full positive-long cursor without JavaScript rounding', async () => {
  const cursor = '9223372036854775807';
  fetch.mockResolvedValue(response({ items: [link], nextCursor: cursor }));
  expect((await fetchAccountLinks(cursor)).nextCursor).toBe(cursor);
  expect(fetch.mock.calls[0][0]).toBe('/api/account/links?before=' + cursor);
});
it.each([[401, true], [403, false]])('recognizes expired/changed sessions: %i', async (status, sessionExpired) => {
  fetch.mockResolvedValue(response(null, status));
  await expect(fetchAccountLinks()).rejects.toMatchObject({ sessionExpired });
});
it.each([
  { items: [{ ...link, shortUrl: 'javascript:alert(1)' }], nextCursor: null },
  { items: [{ ...link, createdAt: 'invalid' }], nextCursor: null },
  { items: [{ ...link, clickCount: -1 }], nextCursor: null },
  { items: [], nextCursor: -3 },
])('rejects invalid saved-account data: %j', async data => {
  fetch.mockResolvedValue(response(data));
  await expect(fetchAccountLinks()).rejects.toThrow('saved links');
});
