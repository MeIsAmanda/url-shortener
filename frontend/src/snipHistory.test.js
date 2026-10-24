import { describe, expect, it } from 'vitest';
import { addToHistory, MAX_RECENT_SNIPS, parseHistory } from './snipHistory.js';

const entry = (number = 1) => ({
  originalUrl: 'https://example.com/' + number,
  shortUrl: 'http://localhost:8080/s/' + number,
  createdAt: '2026-10-25T00:00:00.000Z',
});

describe('browser history data', () => {
  it.each([null, '{broken', '{}', 'null', '"hello"'])('ignores unreadable history: %j', raw => {
    expect(parseHistory(raw)).toEqual([]);
  });
  it('rejects unsafe/malformed records and retains only the displayed fields', () => {
    const records = [
      null,
      { ...entry(), shortUrl: 'javascript:alert(1)' },
      { ...entry(), shortUrl: 'https://user:secret@example.com/s/1' },
      { ...entry(), createdAt: 'invalid' },
      { ...entry(), originalUrl: null },
      { ...entry(), originalUrl: 'a'.repeat(2049) },
      { ...entry(2), ignored: 'extra data' },
    ];
    expect(parseHistory(JSON.stringify(records))).toEqual([entry(2)]);
  });
  it('deduplicates by short URL and caps restored history at 20', () => {
    const records = [entry(), entry(), ...Array.from({ length: 30 }, (_, index) => entry(index + 2))];
    const restored = parseHistory(JSON.stringify(records));
    expect(restored).toHaveLength(MAX_RECENT_SNIPS);
    expect(restored[0]).toEqual(entry());
    expect(new Set(restored.map(item => item.shortUrl)).size).toBe(MAX_RECENT_SNIPS);
  });
  it('puts the latest mapping first and evicts the oldest entry', () => {
    const records = Array.from({ length: 20 }, (_, index) => entry(index));
    const updated = addToHistory(records, entry(30));
    expect(updated).toHaveLength(20);
    expect(updated[0]).toMatchObject({ shortUrl: entry(30).shortUrl, originalUrl: entry(30).originalUrl });
    expect(updated.some(item => item.shortUrl === entry(19).shortUrl)).toBe(false);
  });
  it('updates an existing short URL without collapsing different codes for the same destination', () => {
    const records = [entry(1), { ...entry(2), originalUrl: entry(1).originalUrl }];
    const updated = addToHistory(records, { ...entry(1), originalUrl: 'https://example.com/new' });
    expect(updated).toHaveLength(2);
    expect(updated[0].originalUrl).toBe('https://example.com/new');
    expect(updated[1].shortUrl).toBe(entry(2).shortUrl);
  });
});
