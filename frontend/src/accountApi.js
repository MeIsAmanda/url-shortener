export class AccountRequestError extends Error {
  constructor(message, sessionExpired = false) {
    super(message);
    this.sessionExpired = sessionExpired;
  }
}

async function request(path, options = {}) {
  let response;
  try {
    const timeout = AbortSignal.timeout(10000);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options, signal });
  } catch {
    throw new AccountRequestError('Couldn’t connect. Please try again.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new AccountRequestError('Your session changed. Please sign in again or refresh the page.', response.status === 401);
  }
  if (!response.ok) throw new AccountRequestError('Couldn’t load your account. Please try again.');
  if (response.status === 204) return null;
  return response.json().catch(() => { throw new AccountRequestError('Couldn’t read your account data. Please refresh.'); });
}

export async function fetchSession(signal) {
  const data = await request('/api/auth/session', { signal });
  if (!data || typeof data.googleSignInEnabled !== 'boolean' || typeof data.csrfToken !== 'string'
      || (data.user !== null && (!Number.isInteger(data.user?.id) || typeof data.user?.name !== 'string'))) {
    throw new AccountRequestError('Couldn’t read your sign-in status.');
  }
  return data;
}

export function signOut(csrfToken) {
  return request('/api/auth/logout', { method: 'POST', headers: { 'X-CSRF-TOKEN': csrfToken } });
}

export async function fetchAccountLinks(before, signal) {
  const data = await request('/api/account/links' + (before == null ? '' : '?before=' + encodeURIComponent(before)), { signal });
  const validLink = item => {
    try {
      const url = new URL(item.shortUrl);
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
        && typeof item.code === 'string' && typeof item.originalUrl === 'string'
        && Number.isFinite(Date.parse(item.createdAt))
        && Number.isInteger(item.clickCount) && item.clickCount >= 0;
    } catch { return false; }
  };
  if (!Array.isArray(data?.items) || !data.items.every(validLink)
      || !(data.nextCursor === null || (typeof data.nextCursor === 'string'
        && /^[1-9][0-9]{0,18}$/.test(data.nextCursor) && BigInt(data.nextCursor) <= 9223372036854775807n))) {
    throw new AccountRequestError('Couldn’t read your saved links. Please refresh.');
  }
  return data;
}
