const NETWORK_ERROR = 'We couldn’t connect. Check your connection and try again.';

export class LinkRequestError extends Error {
  constructor(message, fieldError = false) {
    super(message);
    this.name = 'LinkRequestError';
    this.fieldError = fieldError;
  }
}

function isHttpUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export async function createLink(originalUrl) {
  let response;
  try {
    response = await fetch('/api/urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Store the submitted string unchanged; destination validity is assumed.
      body: JSON.stringify({ originalUrl }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new LinkRequestError(NETWORK_ERROR);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 400) {
      throw new LinkRequestError(
        typeof data?.message === 'string' ? data.message : 'We couldn’t process the request. Please try again.',
      );
    }
    if (response.status === 429) {
      throw new LinkRequestError('Too many requests. Please wait a moment and try again.');
    }
    throw new LinkRequestError('We couldn’t shorten this link right now. Please try again.');
  }

  if (!isHttpUrl(data?.shortUrl) || typeof data?.originalUrl !== 'string') {
    throw new LinkRequestError('We received an unexpected response. Please try again.');
  }
  return { originalUrl: data.originalUrl, shortUrl: data.shortUrl };
}
