# Test review guide

These tests were written and executed by the assistant. Amanda's review is still pending. Treat this guide as a starting point for understanding and challenging the tests, not a sign-off.

## Suggested review order

1. Read `frontend/src/App.jsx` alongside `frontend/src/App.test.jsx`: each test acts like a user interacting with the form.
2. Read `frontend/src/api.js` alongside `frontend/src/api.test.js`: these cover the HTTP boundary and failure messages.
3. Read `frontend/browser/shortening.spec.js`: these run in a real browser but deliberately stub the API.
4. Read `frontend/integration/live-api.spec.js`: these use a running real backend and check an actual saved mapping.
5. Review the backend tests under `backend/src/test/java/com/amanda/urlshortener/link/`: start with `Base62EncoderTest`, then `ShortLinkServiceTest`, `ShortLinkApiTest`, `SequenceMigrationTest`, then `ShortLinkRestartIT`.

## Backend sequence-ID checks

- `Base62EncoderTest`: known alphabet values, digit-length transitions, rejection of negatives, and the full positive-long range without truncation.
- `ShortLinkServiceTest`: exact ID/code and submitted-string persistence, no destination or output-length rejection, distinct allocations for repeated destinations, failure propagation without retries, variable-length/legacy lookup, and trusted public-origin configuration.
- `ShortLinkApiTest`: HTTP create/redirect/error behavior, code uniqueness, duplicate assigned-ID rejection without overwrites, legacy aliases, and 48 creations across six worker threads. This is a concurrency correctness check, not a performance measurement.
- `SequenceMigrationTest`: fresh startup at 1, file-backed legacy preservation, reservation of both old row IDs and decoded code values, sequence persistence after database reopen, non-reuse after rollback, and safe failure on exhaustion.
- `ShortLinkRestartIT`: runs after packaging via Maven Failsafe. Starts the JAR with a temporary file database, forces an immediate process stop after a successful creation response, restarts it, verifies the exact redirect, and checks that the next ID advances. Redirect following is disabled. This guards against the delayed-write persistence issue found during manual verification.

Migration tests use temporary file-backed H2 databases. API tests use a separate in-memory database. The packaged restart test uses its own temporary file database and an available local port. None opens or migrates `backend/data/shortener.mv.db`.

From `backend/`, run `.\mvnw.cmd test` for the 55 unit/API/migration cases, or `.\mvnw.cmd verify` for those cases plus packaging and the process-restart integration test (56 backend checks total). On macOS/Linux, use `./mvnw` instead. The packaged test uses the same JDK as Maven, starts two backend processes sequentially, and cleans them up; it does not require a manually running backend.

In Vitest tests, `expect` checks an outcome, `vi.fn()` creates a controllable substitute, and `mockResolvedValue` supplies a fake asynchronous response. React Testing Library queries elements by their accessible role and name; `userEvent` simulates interactions. In Playwright, `page.route` replaces the API only in the isolated browser suite. The live suite has no API interception.

## Frontend suites

| File | Cases | What it checks |
| --- | ---: | --- |
| `src/App.test.jsx` | 12 | Compact labelled tool, one native textbox, clear/reset, input identity/value/focus across Enter submission, unvalidated submissions, pending handling, network retry, stale-result removal, and clipboard feedback |
| `src/api.test.js` | 17 | Exact request/response preservation, blank/short/missing-scheme input, request errors, server/network failures, and malformed generated-link responses |
| `browser/shortening.spec.js` | 11 | Live-field clickability and results at 320/360/390/768/1280px and 844×390 landscape, keyboard submission, clipboard denial, animation replay, reduced motion, field position in the scene, and immediate restoration when editing during the cut |
| `integration/live-api.spec.js` | 2 | Real API creation, actual clipboard contents, saved-code lookup and exact 302 Location, plus acceptance of a short destination with longer output |

The frontend submits strings unchanged without destination validation. The API client checks the generated short URL and response shape, but does not validate the submitted/returned originalUrl. Backend API tests also verify verbatim storage and input above 4096 characters.

The illustration is in `frontend/src/CuttingScene.jsx`; submission-driven transforms and opacity are in `src/styles.css`. It remounts once per submission to replay the finite animation and is memoized so input/copy updates do not redraw it. There is no minimum loading duration or animation-completion gate. Browser checks verify that a fast response is already usable while the scene still animates, and that reduced motion disables the scene animation. These are functional checks, not a frames-per-second benchmark. Open **Original link** to inspect the submitted destination; it stays collapsed initially to keep the result compact.

`frontend/src/SnipInput.jsx` keeps the actual input mounted inside the scissors scene. Two clipped, screen-reader-hidden visual copies provide the splitting effect; they do not accept input or intercept pointers. Pointer/focus/typing cancels the field effect immediately, and errors restore the normal field. Tests scope original-destination assertions to the result region so these decorative copies are not mistaken for additional output. With `CAPTURE_SCREENSHOTS=1`, the live suite also captures `docs/screenshots/input-cutting-desktop.png` at a deterministic mid-animation frame; ordinary test runs do not pause animations.

The input's accessible label is **Put your long URL here!**; the curly arrow is decorative and hidden from screen readers. Responsive browser checks also verify the Sniply page title and that the confetti stays below the input.

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

To refresh the documentation screenshots during that check, also set `$env:CAPTURE_SCREENSHOTS = '1'`. This writes `docs/screenshots/landing-desktop.png` and `docs/screenshots/result-mobile.png`. The screenshots show a real locally generated link, not a deployed service.

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
- [ ] Try a valid long destination, an invalid URL, a short URL, and a stopped backend.
- [ ] Copy and open a generated link; confirm the destination is preserved.
- [ ] Try keyboard-only use and an actual phone in portrait and landscape.
- [ ] Check browser zoom and long-URL wrapping.
- [ ] Run the prepared GitHub checks after pushing and inspect their logs.

## Workflow references

The workflow uses the documented [checkout action](https://github.com/actions/checkout), [Java setup action](https://github.com/actions/setup-java), and [Node setup action](https://github.com/actions/setup-node). Vite documents [development proxy behavior](https://vite.dev/config/server-options#server-proxy) and [preview proxy behavior](https://vite.dev/config/preview-options.html#preview-proxy). The checked-in workflow runs backend and isolated frontend suites; the live suite remains an explicit local check.
