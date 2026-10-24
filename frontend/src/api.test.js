import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLink } from './api.js';

const destination = 'https://example.com/a-long-path?campaign=demo#section';
const shortUrl = 'http://localhost:8080/s/Abc1234';
const response = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

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

  it.each(['', '   ', 'https://x.co', 'example.com', '  supplied text  '])('passes through the submitted string: %j', async (input) => {
    fetch.mockResolvedValue(response(201, { originalUrl: input, shortUrl }));
    expect(await createLink(input)).toEqual({ originalUrl: input, shortUrl });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ originalUrl: input });
  });

  it('uses the request error message for a 400', async () => {
    fetch.mockResolvedValue(response(400, { code: 'INVALID_REQUEST', message: 'Send a JSON object.' }));
    await expect(createLink(destination)).rejects.toThrow('Send a JSON object.');
  });

  it('handles a 400 without a JSON message', async () => {
    fetch.mockResolvedValue({ ok: false, status: 400, json: async () => { throw new SyntaxError(); } });
    await expect(createLink(destination)).rejects.toThrow('We couldn’t process the request.');
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
    { originalUrl: null, shortUrl },
  ])('rejects an unusable success payload: %j', async (data) => {
    fetch.mockResolvedValue(response(201, data));
    await expect(createLink(destination)).rejects.toThrow('unexpected response');
  });
});
