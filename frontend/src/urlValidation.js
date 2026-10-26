import tldText from './tlds.txt?raw';
import tr46 from 'tr46';

export const MAX_URL_LENGTH = 2048;
const tlds = new Set(tldText.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#')));
const formatError = 'Enter a valid web URL with correctly encoded special characters.';
const domainError = 'Use a domain with a recognized ending, such as example.com.';

// Complete a bare address without rewriting an explicit scheme.
// A dotted host with a numeric port is still a bare address.
export function completeProtocol(value) {
  if (!value || /^\s*$/.test(value)) return value;
  if (value.startsWith('//')) return 'https:' + value;
  const explicitScheme = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value);
  const bareHostWithPort = /^[^/?#:\s]+\.[^/?#:\s]+:\d+(?:[/?#]|$)/.test(value);
  if (explicitScheme && !bareHostWithPort) return value;
  return 'https://' + value;
}

// Wait for a dot in a bare hostname so typing "http://" or another explicit
// scheme is never mistaken for the beginning of a bare address.
export function completeProtocolWhileTyping(value) {
  const address = value.startsWith('//') ? value.slice(2) : value;
  return /^[^/?#:\s]+\./.test(address) ? completeProtocol(value) : value;
}

// Reject malformed input before the browser URL parser can repair/normalize it.
export function validateDestination(value) {
  if (typeof value !== 'string' || !value.length) return 'Enter a URL to shorten.';
  if (value.length > MAX_URL_LENGTH) return 'Keep your URL to 2,048 characters or fewer.';
  if (!/^https?:\/\//i.test(value)) return 'Include http:// or https:// at the start.';
  if (/[^A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]/.test(value) || /%(?![A-Fa-f0-9]{2})/.test(value)) return formatError;
  const parts = /^https?:\/\/([^/?#]+)(\/[^?#]*)?(\?[^#]*)?(#[^#]*)?$/i.exec(value);
  if (!parts) return formatError;
  const authority = /^([A-Za-z0-9.-]+)(?::([0-9]{1,5}))?$/.exec(parts[1]);
  if (!authority) return domainError;
  const host = authority[1];
  const labels = host.split('.');
  if (host.length > 253 || labels.length < 2 || !tlds.has(labels.at(-1).toUpperCase())
      || labels.some(label => !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label))) return domainError;
  // URL parsers differ in their acceptance of invalid A-labels (e.g. xn--a).
  // Validate Punycode explicitly, without rewriting the submitted hostname.
  if (labels.some(label => label.toLowerCase().startsWith('xn--') && tr46.toASCII(label, {
    checkHyphens: true,
    checkBidi: true,
    checkJoiners: true,
    useSTD3ASCIIRules: true,
  }) !== label.toLowerCase())) return domainError;
  if (authority[2] && (+authority[2] < 1 || +authority[2] > 65535)) return formatError;
  // Java URI rejects raw brackets in paths; query/fragment brackets are allowed.
  if (/[\[\]]/.test(parts[2] || '')) return formatError;
  try { new URL(value); } catch { return formatError; }
  return null;
}
