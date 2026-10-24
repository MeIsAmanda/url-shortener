import { beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import { HISTORY_KEY } from './snipHistory.js';

const originalUrl = 'https://example.com/our-link?x=%2F#Section';
const shortUrl = 'http://localhost:8080/s/new';
const oldEntry = {
  originalUrl: 'https://example.com/old',
  shortUrl: 'http://localhost:8080/s/old',
  createdAt: '2026-10-25T00:00:00.000Z',
};
const success = () => ({ ok: true, status: 201, json: async () => ({ originalUrl, shortUrl }) });
const panel = () => screen.getByRole('complementary', { name: 'Recent snips' });

function setup() {
  const user = userEvent.setup();
  const view = render(<App />);
  return { user, view, input: screen.getByRole('textbox'), submit: screen.getByRole('button', { name: 'Snip my link' }) };
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(success())));

it('saves successful links and restores the collection after remount', async () => {
  const { user, view, input, submit } = setup();
  await user.type(input, originalUrl);
  await user.click(submit);
  expect(await within(panel()).findByRole('link', { name: 'Open saved snip ' + shortUrl })).toBeVisible();
  expect(JSON.parse(localStorage.getItem(HISTORY_KEY))[0]).toMatchObject({ originalUrl, shortUrl });
  view.unmount();
  render(<App />);
  expect(within(panel()).getByRole('link', { name: 'Open saved snip ' + shortUrl })).toHaveAttribute('href', shortUrl);
  expect(screen.queryByRole('region', { name: 'Freshly snipped!' })).not.toBeInTheDocument();
});

it('keeps invalid input and failed requests out of history', async () => {
  fetch.mockRejectedValue(new TypeError('offline'));
  const { user, input, submit } = setup();
  await user.click(submit);
  expect(fetch).not.toHaveBeenCalled();
  await user.type(input, originalUrl);
  await user.click(submit);
  expect(await screen.findByRole('alert')).toHaveTextContent('couldn’t connect');
  expect(within(panel()).queryAllByRole('listitem')).toHaveLength(0);
  expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
});

it('removes one entry and clears the remaining browser history without API calls', async () => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify([oldEntry, { ...oldEntry, shortUrl }]));
  const { user } = setup();
  await user.click(within(panel()).getByRole('button', { name: 'Remove saved snip ' + oldEntry.shortUrl }));
  expect(within(panel()).getAllByRole('listitem')).toHaveLength(1);
  expect(JSON.parse(localStorage.getItem(HISTORY_KEY))).toHaveLength(1);
  await user.click(within(panel()).getByRole('button', { name: 'Clear history' }));
  expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
  expect(within(panel()).queryAllByRole('listitem')).toHaveLength(0);
  expect(fetch).not.toHaveBeenCalled();
});

it('does not bring cleared entries back when an in-flight creation finishes', async () => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify([oldEntry]));
  let finish;
  fetch.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const { user, input, submit } = setup();
  await user.type(input, originalUrl);
  await user.click(submit);
  await user.click(within(panel()).getByRole('button', { name: 'Clear history' }));
  await act(async () => finish(success()));
  expect(within(panel()).getAllByRole('listitem')).toHaveLength(1);
  expect(JSON.parse(localStorage.getItem(HISTORY_KEY)).map(item => item.shortUrl)).toEqual([shortUrl]);
});

it('keeps shortening usable when browser storage is blocked', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  const { user, input, submit } = setup();
  await user.type(input, originalUrl);
  await user.click(submit);
  expect(await screen.findByRole('link', { name: 'Open link' })).toHaveAttribute('href', shortUrl);
  expect(within(panel()).getByRole('link', { name: 'Open saved snip ' + shortUrl })).toBeVisible();
  expect(within(panel()).getByText(/Browser storage is unavailable/)).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('reports a failed persistent clear and lets the user retry', async () => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify([oldEntry]));
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
  const { user } = setup();
  await user.click(within(panel()).getByRole('button', { name: 'Clear history' }));
  expect(within(panel()).getByText(/Old snips may return/)).toBeVisible();
  expect(localStorage.getItem(HISTORY_KEY)).not.toBeNull();
  remove.mockRestore();
  await user.click(within(panel()).getByRole('button', { name: 'Clear history' }));
  expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
});

it('copies saved links and provides manual-copy guidance on clipboard failure', async () => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify([oldEntry]));
  const { user } = setup();
  const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  const copyButton = within(panel()).getByRole('button', { name: 'Copy saved snip ' + oldEntry.shortUrl });
  await user.click(copyButton);
  expect(copy).toHaveBeenCalledWith(oldEntry.shortUrl);
  expect(copyButton).toHaveTextContent('Copied!');
  copy.mockRejectedValue(new Error('denied'));
  await user.click(copyButton);
  expect(within(panel()).getByText(/copy it manually/)).toBeVisible();
});

it('updates the collection when another tab changes this origin’s history', async () => {
  setup();
  localStorage.setItem(HISTORY_KEY, JSON.stringify([oldEntry]));
  await act(async () => window.dispatchEvent(new StorageEvent('storage', {
    key: HISTORY_KEY, storageArea: localStorage,
  })));
  expect(within(panel()).getByRole('link', { name: 'Open saved snip ' + oldEntry.shortUrl })).toBeVisible();
});
