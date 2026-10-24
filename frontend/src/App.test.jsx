import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';

const originalUrl = 'https://example.com/a-long-path?campaign=demo#section';
const shortUrl = 'http://localhost:8080/s/Abc1234';
const success = () => ({ ok: true, status: 201, json: async () => ({ originalUrl, shortUrl }) });

function setup() {
  const user = userEvent.setup();
  render(<App />);
  return { user, input: screen.getByRole('textbox', { name: 'Your long URL' }), submit: screen.getByRole('button', { name: 'Shorten my link' }) };
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

describe('the shortening journey', () => {
  it('provides a labelled form, landing content, and working section navigation', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Good things.Short links.');
    expect(screen.getByRole('link', { name: /How it works/ })).toHaveAttribute('href', '#how-it-works');
    expect(screen.getByRole('heading', { name: 'Three steps. One small link.' })).toBeInTheDocument();
  });

  it('submits blank input without destination validation', async () => {
    fetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ originalUrl: '', shortUrl }) });
    const { user, submit } = setup();
    await user.click(submit);
    expect(await screen.findByRole('link', { name: 'Open link' })).toBeInTheDocument();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ originalUrl: '' });
  });

  it('submits input without requiring a scheme', async () => {
    fetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ originalUrl: 'example.com', shortUrl }) });
    const { user, input, submit } = setup();
    await user.type(input, 'example.com');
    await user.click(submit);
    expect(await screen.findByRole('link', { name: 'Open link' })).toBeInTheDocument();
    expect(input).toHaveValue('example.com');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ originalUrl: 'example.com' });
  });

  it('submits with Enter and displays the real returned destination and short link', async () => {
    fetch.mockResolvedValue(success());
    const { user, input } = setup();
    await user.type(input, `${originalUrl}{Enter}`);
    const open = await screen.findByRole('link', { name: 'Open link' });
    expect(open).toHaveAttribute('href', shortUrl);
    expect(open).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText(originalUrl)).toBeInTheDocument();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ originalUrl });
  });

  it('blocks duplicate requests while pending and restores the form afterward', async () => {
    let finish;
    fetch.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { user, input, submit } = setup();
    await user.type(input, originalUrl);
    await user.click(submit);
    expect(screen.getByRole('button', { name: 'Shortening…' })).toBeDisabled();
    expect(input).toHaveAttribute('readonly');
    await user.click(submit);
    await user.click(input);
    await user.keyboard('{Enter}');
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => finish(success()));
    expect(await screen.findByRole('button', { name: 'Shorten my link' })).toBeEnabled();
  });

  it('accepts a short destination and displays the generated link', async () => {
    fetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ originalUrl: 'https://x.co', shortUrl }) });
    const { user, input, submit } = setup();
    await user.type(input, 'https://x.co');
    await user.click(submit);
    expect(await screen.findByRole('link', { name: 'Open link' })).toHaveAttribute('href', shortUrl);
    expect(input).toHaveValue('https://x.co');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('preserves input after a network failure and supports retry', async () => {
    fetch.mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(success());
    const { user, input, submit } = setup();
    await user.type(input, originalUrl);
    await user.click(submit);
    expect(await screen.findByRole('alert')).toHaveTextContent('couldn’t connect');
    expect(input).toHaveValue(originalUrl);
    await user.click(submit);
    expect(await screen.findByRole('link', { name: 'Open link' })).toBeInTheDocument();
  });

  it('removes the previous result when the input changes', async () => {
    fetch.mockResolvedValue(success());
    const { user, input, submit } = setup();
    await user.type(input, originalUrl);
    await user.click(submit);
    await screen.findByRole('link', { name: 'Open link' });
    await user.type(input, 'extra');
    expect(screen.queryByRole('link', { name: 'Open link' })).not.toBeInTheDocument();
  });

  it('copies the returned URL and announces success', async () => {
    fetch.mockResolvedValue(success());
    const { user, input, submit } = setup();
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await user.type(input, originalUrl);
    await user.click(submit);
    await user.click(await screen.findByRole('button', { name: 'Copy link' }));
    expect(copy).toHaveBeenCalledWith(shortUrl);
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument();
    expect(screen.getByText('Short link copied to clipboard.')).toBeInTheDocument();
  });

  it('explains clipboard failure and keeps the URL available for manual copying', async () => {
    fetch.mockResolvedValue(success());
    const { user, input, submit } = setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Permission denied'));
    await user.type(input, originalUrl);
    await user.click(submit);
    await user.click(await screen.findByRole('button', { name: 'Copy link' }));
    expect(await screen.findByText(/copy it manually/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: shortUrl })).toHaveAttribute('href', shortUrl);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy link' })).toBeEnabled());
  });
});
