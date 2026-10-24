import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { completeProtocol, completeProtocolWhileTyping, MAX_URL_LENGTH, validateDestination } from './urlValidation.js';
import tlds from './tlds.txt?raw';

const fixture = readFileSync(resolve('../backend/src/test/resources/validation/url-cases.tsv'), 'utf8');
const cases = fixture.trimEnd().split(/\r?\n/).slice(1).map(line => {
  const [valid, input] = line.split('\t');
  return { valid: valid === 'true', input };
});

describe('protocol completion in the UI', () => {
  it.each([
    ['e', 'e'],
    ['http', 'http'],
    ['http:/', 'http:/'],
    ['https://', 'https://'],
    ['example.', 'https://example.'],
    ['www.example.com/a?x=%2F', 'https://www.example.com/a?x=%2F'],
    ['http://example.com', 'http://example.com'],
    ['ftp://example.com', 'ftp://example.com'],
    ['//example.com/a', 'https://example.com/a'],
  ])('completes keyboard input %j as %j', (input, expected) => {
    expect(completeProtocolWhileTyping(input)).toBe(expected);
  });
  it.each([
    ['example.com', 'https://example.com'],
    ['www.example.com/a?x=%2F&x=2#Section', 'https://www.example.com/a?x=%2F&x=2#Section'],
    ['example.com:8443/a', 'https://example.com:8443/a'],
    ['//example.com/a', 'https://example.com/a'],
    ['http://example.com', 'http://example.com'],
    ['HTTPS://Example.COM/a%20b', 'HTTPS://Example.COM/a%20b'],
    ['ftp://example.com', 'ftp://example.com'],
    ['mailto:user@example.com', 'mailto:user@example.com'],
    ['javascript:alert(1)', 'javascript:alert(1)'],
    ['https:/example.com', 'https:/example.com'],
    ['', ''],
    ['   ', '   '],
  ])('completes %j as %j', (input, expected) => {
    expect(completeProtocol(input)).toBe(expected);
    expect(completeProtocol(expected)).toBe(expected);
  });
  it('counts the inserted protocol towards the length limit', () => {
    const bare = 'example.com/' + 'a'.repeat(2048 - 'https://example.com/'.length);
    expect(validateDestination(completeProtocol(bare))).toBeNull();
    expect(validateDestination(completeProtocol(bare + 'a'))).toMatch('2,048');
  });
});

describe('destination policy shared with the backend', () => {
  it.each(cases)('accepts=$valid: $input', ({ valid, input }) => {
    expect(validateDestination(input) === null).toBe(valid);
  });
  it.each([null, undefined, ''])('requires a destination: %j', input => {
    expect(validateDestination(input)).toBeTruthy();
  });
  it.each(['https://example.com\n', 'https://example.com\t', 'https://example.com/\r\n', 'https://example.com/?q=\0'])('rejects controls instead of letting URL repair them: %j', input => {
    expect(validateDestination(input)).toBeTruthy();
  });
  it('accepts the exact length limit and rejects one extra character', () => {
    const atLimit = 'https://example.com/' + 'a'.repeat(MAX_URL_LENGTH - 'https://example.com/'.length);
    expect(validateDestination(atLimit)).toBeNull();
    expect(validateDestination(atLimit + 'a')).toMatch('2,048');
  });
  it('bundles the same IANA snapshot as the backend', () => {
    const backendTlds = readFileSync(resolve('../backend/src/main/resources/validation/tlds.txt'), 'utf8');
    expect(tlds.replaceAll('\r\n', '\n')).toBe(backendTlds.replaceAll('\r\n', '\n'));
  });
});
