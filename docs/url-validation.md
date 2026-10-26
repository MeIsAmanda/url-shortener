# Destination URL validation

Policy updated on 25 October 2026. This supersedes the earlier accept-any-string policy for new links. It does not restore the requirement that generated output be shorter than its input.

## Accepted input

In the web form, an omitted protocol is completed as `https://` as you type or paste a bare hostname containing a dot, with blur/submission as a fallback, and the completed value appears in the textbox. `//example.com` becomes `https://example.com`; a bare hostname with a port is supported too. Explicit schemes, including `http://`, are left unchanged. Unsupported or malformed explicit schemes still fail validation. Completion preserves the caret and waits for composition to finish; deletion does not immediately reinsert the prefix. Blank input stays blank.

The rules below apply to the completed URL, including the length of the added prefix. Direct API callers must supply an explicit HTTP(S) scheme; the backend does not guess one. Apart from this visible frontend completion, accepted input is not rewritten or trimmed.

- A nonempty absolute URL beginning with `http://` or `https://`, case-insensitively.
- At most **2,048 characters**, including scheme, host, path, query, and fragment. This is Sniply's application limit, not a universal URL standard.
- A domain with at least two labels and a recognized top-level domain from the bundled IANA snapshot. Labels contain ASCII letters, digits, and interior hyphens, with a maximum of 63 characters each and 253 for the complete hostname.
- An optional numeric port from 1 through 65535.
- ASCII URL characters, with spaces, Unicode path/query text, and special characters percent-encoded as needed. Every percent escape must contain exactly two hexadecimal digits. For example, use `?q=two%20words` or `?q=two+words`, not a raw space or `%ZZ`.
- International domain names in Punycode form, such as `https://xn--bcher-kva.de/`. Raw Unicode input is rejected rather than rewritten.

Whitespace is rejected, including leading/trailing spaces, tabs, and line breaks; input is not trimmed. Embedded credentials, localhost/single-label hosts, IP literals, empty ports, trailing hostname dots, malformed labels, invalid escapes, and illegal path/query characters are rejected. Valid query delimiters, repeated parameters, `+`, encoded bytes, path case, and fragments are preserved exactly. Validation checks escape syntax; it does not interpret every query parameter's meaning or require a particular character encoding for encoded bytes.

Examples:

| Input | Result |
| --- | --- |
| `https://example.com/a%20b?q=two+words&x=%2F#Section` | Accepted unchanged |
| `https://x.co` | Accepted even when the generated link is longer |
| `example.com` | Web form shows/submits `https://example.com`; direct API input is rejected |
| `https://example.notarealtld/` | Rejected: unrecognized TLD |
| `https://example.com/?q=two words` | Rejected: raw space |
| `https://example.com/?q=%ZZ` | Rejected: malformed percent escape |

## Format and availability

No DNS resolution, HTTP request, website preview, or availability check runs during validation. A recognized TLD does not prove that the complete domain is registered, that a page exists, or that it is safe. A syntactically valid URL can later be unavailable or return an error. The bundled TLD list does not track domain registrations or public-suffix boundaries.

## Implementation

The backend's `UrlValidator.validate` runs in `ShortLinkService.create` **before** ID allocation and insertion. Rejections return HTTP 400 with `{ "code": "INVALID_URL", "message": "..." }`. Missing/null destinations receive the same validation response. Malformed JSON remains `INVALID_REQUEST`.

The frontend completes a missing protocol, displays that value, then checks the same policy before starting the scissors animation or making a request; its API client also validates callers and expects a complete URL. The input receives accessible error feedback and focus, retains its value, and can be corrected and retried. Overlong input is rejected rather than silently truncated. Backend validation remains authoritative for clients that bypass the UI.

For hostname labels beginning with `xn--`, the frontend explicitly checks IDNA validity and canonical ASCII spelling using the pinned `tr46` dependency, with hyphen, bidirectional-text, joiner, and STD3 checks enabled. It uses the result only to validate; the submitted URL is never rewritten. This prevents runtime-dependent URL parsers from accepting malformed Punycode such as `xn--a`, while retaining valid encoded international domains. The backend retains its existing Java IDN check. These parsers implement different IDNA generations; shared fixtures verify the documented common cases rather than claiming identical Unicode behavior for every possible label. See the [tr46 API](https://github.com/jsdom/tr46).

Accepted input is saved without normalization. Redirect resolution does not revalidate previously saved destinations. Flyway V1–V3 and the CLOB column remain unchanged, preserving existing links, including those over the new creation limit. No new migration is required for a creation-time rule.

The 2,048-character rule bounds the destination value after JSON parsing; it is not a total HTTP request-body limit. Broader security work and performance measurement remain separate milestones.

## TLD snapshot and maintenance

Both `backend/src/main/resources/validation/tlds.txt` and `frontend/src/tlds.txt` contain the same IANA snapshot, version **2026102400**. Runtime validation works offline. Refresh both files together when the policy needs a newer list; the frontend test checks they match. An outdated snapshot may reject a newly delegated TLD.

From the project root in PowerShell:

```powershell
Invoke-WebRequest -Uri 'https://data.iana.org/TLD/tlds-alpha-by-domain.txt' -OutFile backend/src/main/resources/validation/tlds.txt
Copy-Item -LiteralPath backend/src/main/resources/validation/tlds.txt -Destination frontend/src/tlds.txt
```

Review the downloaded snapshot/header and rerun the relevant backend/frontend checks before committing it. No dependency downloads or runtime network lookups are introduced by the validator.

## Verification

`backend/src/test/resources/validation/url-cases.tsv` supplies shared acceptance/rejection examples to Java and Vitest. Separate boundary/control-character tests and service assertions verify rejection before allocation/storage. API tests cover 400 responses, missing/null values, exact accepted length, and legacy redirects. Browser tests cover field errors and correction at mobile widths; the live suite checks a corrected encoded URL through the real API/redirect plus a direct invalid API request.

See [testing.md](testing.md) for commands and [verification.md](verification.md) for execution results.

References: [IANA TLD data](https://data.iana.org/TLD/tlds-alpha-by-domain.txt), [Java 25 URI parser](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/net/URI.html), and [WHATWG URL standard](https://url.spec.whatwg.org/). Java's URI parser and the browser URL parser differ; shared fixtures and explicit checks prevent common browser repairs, such as stripping controls, from silently changing submitted input.
