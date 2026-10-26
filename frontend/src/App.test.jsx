import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
vi.mock('./accountApi.js', () => ({
  fetchSession: async () => ({ user: null, googleSignInEnabled: false, csrfToken: 'guest-token' }),
}));

const originalUrl = 'https://example.com/a-long-path?campaign=demo#section';
const shortUrl = 'http://localhost:8080/s/Abc1234';
const success = () => ({ ok: true, status: 201, json: async () => ({ originalUrl, shortUrl }) });

function setup() {
  const user = userEvent.setup();
  render(<App />);
  return { user, input: screen.getByRole('textbox', { name: 'Put your long URL here!' }), submit: screen.getByRole('button', { name: 'Snip my link' }) };
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

describe('the shortening journey', () => {
  it('clears the successful destination and keeps the result available', async () => {
    fetch.mockResolvedValue(success());
    const { user, input, submit } = setup();
    await user.type(input, originalUrl);
    await user.click(submit);
    const open = await screen.findByRole('link', { name: 'Open link' });
    expect(input).toHaveValue('');
    expect(open).toHaveAttribute('href', shortUrl);
    expect(within(screen.getByRole('region', { name: 'Freshly snipped!' })).getByText(originalUrl)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear URL' })).toBeDisabled();
  });

  it('provides a compact labelled tool without the old instructional section', () => {
    setup();
    expect(screen.getByRole('link', { name: 'Sniply home' })).toHaveTextContent('sniply.');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Long link? Snip, snip.');
    expect(screen.queryByRole('link', { name: /How it works/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Three steps. One small link.' })).not.toBeInTheDocument();
    expect(screen.queryByText('the little link studio')).not.toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('keeps the real input mounted and focused but clears its value after success', async () => {
    fetch.mockResolvedValue(success());
    const { user, input } = setup();
    await user.type(input, `${originalUrl}{Enter}`);
    await screen.findByRole('link', { name: 'Open link' });
    expect(screen.getByRole('textbox', { name: 'Put your long URL here!' })).toBe(input);
    expect(input).toHaveFocus();
    expect(input).toHaveValue('');
  });

  it('rejects blank input and focuses the field without requesting or animating', async () => {
    const { user, input, submit } = setup();
    await user.click(submit);
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a URL');
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByTestId('cutting-scene')).not.toHaveClass('is-snipping');
  });

  it('shows the default protocol and sends the completed URL on Enter', async () => {
    fetch.mockResolvedValue(success());
    const { user, input } = setup();
    await user.type(input, 'example.com');
    expect(input).toHaveValue('https://example.com');
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('link', { name: 'Open link' })).toBeInTheDocument();
    expect(input).toHaveValue('');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ originalUrl: 'https://example.com' });
    expect(input).toHaveFocus();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('completes the protocol during typing and can still clear it', async () => {
    const { user, input } = setup();
    await user.type(input, 'example.com/a?x=%2F#Section');
    expect(input).toHaveValue('https://example.com/a?x=%2F#Section');
    await user.tab();
    expect(input).toHaveValue('https://example.com/a?x=%2F#Section');
    expect(fetch).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Clear URL' }));
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });

  it('lets keyboard users delete the prefix and type an explicit protocol', async () => {
    const { user, input } = setup();
    await user.type(input, 'example.com');
    input.setSelectionRange(0, 8);
    await user.keyboard('{Backspace}');
    expect(input).toHaveValue('example.com');
    await user.keyboard('http://');
    expect(input).toHaveValue('http://example.com');
    await user.clear(input);
    await user.type(input, 'http://example.com');
    expect(input).toHaveValue('http://example.com');
  });

  it('waits for composition to finish before completing the protocol', () => {
    const { input } = setup();
    fireEvent.compositionStart(input);
    fireEvent.input(input, {
      target: { value: 'example.com' },
      isComposing: true,
      inputType: 'insertCompositionText',
    });
    expect(input).toHaveValue('example.com');
    fireEvent.compositionEnd(input);
    expect(input).toHaveValue('https://example.com');
  });

  it('submits with Enter and displays the real returned destination and short link', async () => {
    fetch.mockResolvedValue(success());
    const { user, input } = setup();
    await user.type(input, `${originalUrl}{Enter}`);
    const open = await screen.findByRole('link', { name: 'Open link' });
    expect(open).toHaveAttribute('href', shortUrl);
    expect(open).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(screen.getByRole('region', { name: 'Freshly snipped!' })).getByText(originalUrl)).toBeInTheDocument();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ originalUrl });
  });

  it('blocks duplicate requests while pending and restores the form afterward', async () => {
    let finish;
    fetch.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { user, input, submit } = setup();
    await user.type(input, originalUrl);
    await user.click(submit);
    expect(screen.getByRole('button', { name: 'Snipping…' })).toBeDisabled();
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveValue(originalUrl);
    await user.click(submit);
    await user.click(input);
    await user.keyboard('{Enter}');
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => finish(success()));
    expect(await screen.findByRole('button', { name: 'Snip my link' })).toBeEnabled();
  });

  it('accepts a short destination and displays the generated link', async () => {
    fetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ originalUrl: 'https://x.co', shortUrl }) });
    const { user, input, submit } = setup();
    await user.type(input, 'https://x.co');
    await user.click(submit);
    expect(await screen.findByRole('link', { name: 'Open link' })).toHaveAttribute('href', shortUrl);
    expect(input).toHaveValue('');
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
    expect(input).toHaveValue('');
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
