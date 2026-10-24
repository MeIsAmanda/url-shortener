# Test review guide

These tests were written and executed by the assistant. Completion of Amanda's test review has not been recorded. Treat this guide as a starting point for understanding and challenging the tests, not a sign-off. Suite sizes describe the checked-in cases; dated execution results are in [verification.md](verification.md).

## Suggested review order

1. Read `frontend/src/App.jsx` alongside `frontend/src/App.test.jsx`: each test acts like a user interacting with the form.
2. Read `frontend/src/api.js` alongside `frontend/src/api.test.js`: these cover the HTTP boundary and failure messages.
3. Read `frontend/browser/shortening.spec.js`: these run in a real browser but deliberately stub the API.
4. Read `frontend/integration/live-api.spec.js`: these use a running real backend and check an actual saved mapping.
   For browser history, also read `snipHistory.js`, `useSnipHistory.js`, and `RecentSnips.jsx` alongside their data/UI tests and `browser/history.spec.js`. See [recent-snips.md](recent-snips.md).
5. Read `frontend/src/urlValidation.js` with `urlValidation.test.js`, then backend `UrlValidator` and `UrlValidatorTest`. Both suites consume `backend/src/test/resources/validation/url-cases.tsv`; the frontend also verifies both bundled IANA lists match. See [url-validation.md](url-validation.md).
6. Review the other backend tests under `backend/src/test/java/com/amanda/urlshortener/link/`: start with `Base62EncoderTest`, then `ShortLinkServiceTest`, `ShortLinkApiTest`, `SequenceMigrationTest`, then `ShortLinkRestartIT`.
7. Read `account/AccountApiTest.java` with the account/security controllers/configuration, then frontend `Account.test.jsx`, `accountApi.test.js`, and `browser/accounts.spec.js`. These use test OIDC principals/stubbed account responses; a real Google sign-in remains manual after [setup](accounts.md).

## Backend sequence-ID checks

- `Base62EncoderTest`: known alphabet values, digit-length transitions, rejection of negatives, and the full positive-long range without truncation.
- `UrlValidatorTest`: shared format/TLD cases, missing/empty input, controls, and the exact 2,048-character boundary.
- `ShortLinkServiceTest`: validation before allocation/storage, exact ID/code and accepted-URL persistence, no output-length rejection, distinct allocations for repeated destinations, failure propagation without retries, variable-length/legacy lookup, and trusted public-origin configuration.
- `ShortLinkApiTest`: HTTP create/redirect/error behavior, code uniqueness, duplicate assigned-ID rejection without overwrites, legacy aliases, and 48 creations across six worker threads. This is a concurrency correctness check, not a performance measurement.
- `SequenceMigrationTest`: fresh startup at 1, file-backed legacy preservation, reservation of both old row IDs and decoded code values, sequence persistence after database reopen, non-reuse after rollback, and safe failure on exhaustion.
- `AccountApiTest`: first-login identity reuse, owner isolation, CSRF including the actual session token, logout, expired-session creation rejection, cursor pagination, Google authorization state/nonce routing, HEAD handling, and 48 concurrent redirect increments.
- The V4 migration/reopen case also verifies preservation of legacy unowned links, zero initial counts, durable accounts/ownership/counters, and the owner foreign key.
- `ShortLinkRestartIT`: runs after packaging via Maven Failsafe. Starts the JAR with a temporary file database, forces an immediate process stop after a successful creation response, restarts it, verifies the exact redirect, and checks that the next ID advances. Redirect following is disabled. This guards against the delayed-write persistence issue found during manual verification.

Migration tests use temporary file-backed H2 databases. API tests use a separate in-memory database. The packaged restart test uses its own temporary file database and an available local port. None opens or migrates `backend/data/shortener.mv.db`.

From `backend/`, run `.\mvnw.cmd test` for the 135 account/security/validator/unit/API/migration cases, or `.\mvnw.cmd verify` for those cases plus packaging and the process-restart integration test (136 backend checks total). On macOS/Linux, use `./mvnw` instead. The packaged test uses the same JDK as Maven, starts two backend processes sequentially, and cleans them up; it does not require a manually running backend or Google credentials.

In Vitest tests, `expect` checks an outcome, `vi.fn()` creates a controllable substitute, and `mockResolvedValue` supplies a fake asynchronous response. React Testing Library queries elements by their accessible role and name; `userEvent` simulates interactions. In Playwright, `page.route` replaces the API only in the isolated browser suite. The live suite has no API interception.

## Frontend suites

| File | Cases | What it checks |
| --- | ---: | --- |
| `src/App.test.jsx` | 15 | Compact labelled tool, clear/reset, input identity/value/focus, keyboard/paste protocol completion, prefix editing, composition, and Enter, validation and correction, pending handling, network retry, stale-result removal, and clipboard feedback |
| `src/api.test.js` | 21 | Exact accepted request/response preservation, invalid input rejected before fetch, backend field errors, server/network failures, and malformed generated-link responses |
| `src/urlValidation.test.js` | 76 | Shared format/TLD fixtures, missing input, controls, exact length boundary, protocol completion/preservation, and identical backend/frontend TLD snapshots |
| `src/snipHistory.test.js` | 9 | Malformed/untrusted saved data, permitted link schemes, deduplication, newest-first insertion, eviction, and separate short codes for the same destination |
| `src/RecentSnips.test.jsx` | 8 | Restore on remount, success-only history, removal/clear, clear during a pending creation, unavailable storage, failed clear/retry, clipboard feedback, and simulated cross-tab storage updates |
| `src/accountApi.test.js` | 11 | Session shape, same-origin/no-store requests, CSRF logout, string cursors, expired/changed sessions, and malformed private-history responses |
| `src/Account.test.jsx` | 8 | Sign-in UI, dates/click refresh/pagination, owned creation headers, guest/account history separation, logout, late responses, session expiry, and account changes on focus |
| `browser/shortening.spec.js` | 22 | Live-field interaction across six viewport sizes, real keyboard completion/caret/middle-edit/deletion checks and button/Enter submission, validation errors without requests at 320px, keyboard correction, clipboard denial, animation replay, reduced motion, and restoration when editing during the cut |
| `browser/history.spec.js` | 11 | Persistence, ordering, side/bottom geometry, clipboard/removal/clear, quota failure, and full-collection checks at five desktop viewport sizes proving only the history list scrolls before/after creation |
| `browser/accounts.spec.js` | 3 | Mocked signed-in My links at 320/1280px, dates/counts/refresh, owned headers, logout, and unavailable sign-in without Google configuration |
| `integration/live-api.spec.js` | 4 | Real guest creation/clipboard/redirect/history/validation plus session metadata, private API rejection, expired-account creation protection, and CSRF logout enforcement |

The frontend visibly adds https:// during bare-hostname keyboard entry/paste, with blur/submit as a fallback, validates the completed value, and submits that accepted value unchanged. Completion tests include bare hosts with ports, protocol-relative addresses, explicit schemes, and the length limit after prefix insertion. The API client and backend still require complete URLs; neither guesses a protocol. Backend API tests verify 400 validation responses, acceptance at 2,048 and rejection at 2,049 characters, and redirects for previously saved values above the new limit.

The illustration is in `frontend/src/CuttingScene.jsx`; submission-driven transforms and opacity are in `src/styles.css`. It remounts once per submission to replay the finite animation and is memoized so input/copy updates do not redraw it. There is no minimum loading duration or animation-completion gate. Browser checks verify that a fast response is already usable while the scene still animates, and that reduced motion disables the scene animation. These are functional checks, not a frames-per-second benchmark. Open **Original link** to inspect the submitted destination; it stays collapsed initially to keep the result compact.

`frontend/src/SnipInput.jsx` keeps the actual input mounted inside the scissors scene. Two clipped, screen-reader-hidden visual copies provide the splitting effect; they do not accept input or intercept pointers. Pointer/focus/typing cancels the field effect immediately, and errors restore the normal field. Tests scope original-destination assertions to the result region so these decorative copies are not mistaken for additional output. With `CAPTURE_SCREENSHOTS=1`, the live suite also captures `docs/screenshots/input-cutting-desktop.png` at a deterministic mid-animation frame; ordinary test runs do not pause animations.

The input's accessible label is **Put your long URL here!**; the curly arrow is decorative and hidden from screen readers. Responsive browser checks also verify the Sniply page title and that the confetti stays below the input.

The native pixel-art cursor is in `frontend/public/scissors-cursor.svg`, with hover/fine-pointer CSS rules in `src/styles.css`. The cursor's handle centers are transparent. Check it manually over the page, links, buttons, and the editable input; the input should retain its text cursor and a pending submit should retain its wait cursor. Touch-only devices should not get a custom cursor. Existing automated suites do not specifically test this asset; the earlier Chrome spot check is recorded separately from suite results.

The test setup clears localStorage before each Vitest case, and Playwright cases use separate browser contexts. History tests seed only their temporary test storage. Blocked/quota/clear failures are deliberately simulated; the browser suite does not use the person's normal browser profile or history. No new history API or database migration exists.

## Commands

From `frontend/`, after `npm ci`:

```powershell
npm test
npm run test:watch
npm run build
npx playwright install chromium
npm run test:browser
```

The watch command stays running; exit it before continuing in the same terminal. The other commands finish. For Linux browser setup, use `npx playwright install --with-deps chromium` if OS libraries are missing. CI performs that installation automatically.

Alternatively, use an installed Chrome with `$env:PLAYWRIGHT_CHANNEL = 'chrome'` in PowerShell; the tests then use that browser instead of downloaded Chromium.

The browser commands start and stop their own Vite preview on port 4173. Build first, because they exercise `dist/`. The default backend proxy target is port 8080. An existing preview server can be reused locally; make sure it has the intended proxy configuration.

## Optional live check

This suite creates a mapping. Use an isolated backend database so it doesn't add test links to your development data. Example PowerShell terminal one, from `backend/` after `mvnw.cmd verify`:

```powershell
$env:PORT = '8081'
$env:PUBLIC_BASE_URL = 'http://127.0.0.1:4173'
$env:DATABASE_URL = 'jdbc:h2:mem:frontend-check;DB_CLOSE_DELAY=-1'
java -jar target/url-shortener-0.0.1-SNAPSHOT.jar
```

Terminal two, from `frontend/`:

```powershell
$env:BACKEND_PROXY_TARGET = 'http://127.0.0.1:8081'
npm run build
npm run test:live
```

To refresh the documentation screenshots during that check, also set `$env:CAPTURE_SCREENSHOTS = '1'`. This writes `docs/screenshots/landing-desktop.png`, `docs/screenshots/input-cutting-desktop.png`, `docs/screenshots/history-desktop.png`, `docs/screenshots/result-mobile.png`, and `docs/screenshots/validation-mobile.png`. The mid-cut image pauses animations at a controlled frame only for screenshot capture. The screenshots show a real locally generated link, not a deployed service, and do not capture the native cursor.

The test requests the short-code route through the local proxy with `maxRedirects: 0`. It asserts the 302 response and original destination, including query and fragment, without visiting the external website. Stop the isolated backend with Ctrl+C when finished. Environment variables apply to the current shell; open fresh terminals for normal development or remove the test-specific overrides.

## What passing results do not prove

- The mocked suites do not prove real persistence or backend integration.
- The live suite checks an actual mapping but does not restart the backend to test disk persistence.
- Chromium viewport checks do not replace an actual phone, mobile Safari, on-screen keyboard, browser zoom, screen-reader, or visual contrast review.
- Error-path tests are functional checks; no security scan or performance test has been performed.
- Local workflow-equivalent commands do not establish that GitHub Actions has run. Confirm that after pushing.

## Manual review checklist

- [ ] Read the assertions and confirm they represent the requirements.
- [ ] Run component tests in watch mode and inspect at least one failure by temporarily changing expected behavior, then restore it.
- [ ] Submit valid long/short URLs; confirm accepted encodings remain unchanged. Try a bare domain and verify https:// appears during keyboard entry/paste once the hostname contains a dot, with blur/Enter/button submission as a fallback; explicit http:// should stay unchanged. Try blank input, an unsupported scheme, whitespace, an unknown TLD, malformed escapes, and an over-limit completed URL; confirm helpful errors and correction/retry. Test a stopped backend separately.
- [ ] Copy and open a generated link; confirm the destination is preserved.
- [ ] Try keyboard-only use and an actual phone in portrait and landscape.
- [ ] Check browser zoom and long-URL wrapping.
- [ ] Check the scissors cursor, transparent handle centers, text/wait cursors, and touch-only fallback.
- [ ] Create several snips, reload, and check newest-first history on desktop/mobile. Copy/remove entries and clear the list; saved backend links should still redirect. Try another tab and check the shared collection on the same frontend origin.
- [ ] Run the prepared GitHub checks after pushing and inspect their logs.
- [ ] Configure a real Google OAuth client, sign in with two test accounts, check owner isolation and exact redirects/count updates, then sign out/restart/sign back in. This has not been automated against Google.

## Workflow references

The workflow uses the documented [checkout action](https://github.com/actions/checkout), [Java setup action](https://github.com/actions/setup-java), and [Node setup action](https://github.com/actions/setup-node). Vite documents [development proxy behavior](https://vite.dev/config/server-options#server-proxy) and [preview proxy behavior](https://vite.dev/config/preview-options.html#preview-proxy). The checked-in workflow runs backend and isolated frontend suites; the live suite remains an explicit local check.
