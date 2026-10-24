import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLink, validateInput } from './api.js';

const destination = 'https://example.com/a-long-path?campaign=demo#section';
const shortUrl = 'http://localhost:8080/s/Abc1234';
const response = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

describe('quick input feedback', () => {
  it.each(['', '   '])('rejects blank input %j', (input) => {
    expect(validateInput(input)).toBe('Enter a URL to get started.');
  });

  it.each(['example.com', 'javascript:alert(1)', 'ftp://example.com'])('requires HTTP(S): %s', (input) => {
    expect(validateInput(input)).toMatch(/Include https/);
  });

  it('allows HTTP(S) through to backend validation', () => {
    expect(validateInput('  HTTPS://example.com/CaseSensitive  ')).toBe('');
  });
});

describe('createLink API boundary', () => {
  it('posts the exact submitted destination and returns the API result', async () => {
    fetch.mockResolvedValue(response(201, { originalUrl: destination, shortUrl }));
    expect(await createLink(`  ${destination}  `)).toEqual({ originalUrl: destination, shortUrl });
    expect(fetch).toHaveBeenCalledWith('/api/urls', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalUrl: `  ${destination}  ` }),
      signal: expect.any(AbortSignal),
    }));
  });

  it('uses the backend validation message for a 400', async () => {
    fetch.mockResolvedValue(response(400, { code: 'INVALID_URL', message: 'This URL is already too short.' }));
    await expect(createLink(destination)).rejects.toMatchObject({ message: 'This URL is already too short.', fieldError: true });
  });

  it('handles a 400 without a JSON message', async () => {
    fetch.mockResolvedValue({ ok: false, status: 400, json: async () => { throw new SyntaxError(); } });
    await expect(createLink(destination)).rejects.toThrow('Check your URL and try again.');
  });

  it('provides retry guidance for 429', async () => {
    fetch.mockResolvedValue(response(429, {}));
    await expect(createLink(destination)).rejects.toThrow('Too many requests.');
  });

  it('does not expose server diagnostics on a 500', async () => {
    fetch.mockResolvedValue(response(500, { message: 'Internal SQL diagnostic' }));
    await expect(createLink(destination)).rejects.toThrow('We couldn’t shorten this link right now.');
  });

  it.each(['TypeError', 'TimeoutError'])('handles network or timeout failure: %s', async (name) => {
    fetch.mockRejectedValue(Object.assign(new Error('request failed'), { name }));
    await expect(createLink(destination)).rejects.toThrow('We couldn’t connect.');
  });

  it.each([
    null,
    { originalUrl: destination },
    { originalUrl: destination, shortUrl: 'javascript:alert(1)' },
    { originalUrl: destination, shortUrl: 'https://user:secret@example.com/s/a' },
    { originalUrl: 'not a url', shortUrl },
  ])('rejects an unusable success payload: %j', async (data) => {
    fetch.mockResolvedValue(response(201, data));
    await expect(createLink(destination)).rejects.toThrow('unexpected response');
  });
});
