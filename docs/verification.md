# Project verification

The Snowflake/Base62 revision was checked on 25 October 2026 with Java 25/Spring Boot 4.1.2, Node 20.19.5, and installed headless Chrome. Earlier milestones retain their original results and policies. No hosted GitHub CI result or real Google-provider login is claimed.

## Latest recorded results

| Check | Result | Boundary |
| --- | --- | --- |
| Backend Maven verify | 156 passed: 155 allocator/account/security/validator/unit/API/migration cases plus 1 packaged restart check | Snowflake revision; isolated databases; executable JAR built; account tests use OIDC test principals |
| Frontend tests | 148 passed across 7 files in the preceding Google-account milestone | Not rerun for this allocator-only change; no frontend implementation changes were needed |
| Frontend production build | Passed again for Snowflake revision | Builds the existing UI with the user's current page edit |
| Isolated Chrome browser suite | 36 passed in the preceding Google-account milestone | Not rerun for this allocator-only change; account UI uses stubbed sessions/history |
| Live Chrome browser suite | 4 passed again against the Snowflake backend | Real guest API/clipboard/redirect, history/validation, session metadata, private-history rejection, expired-account creation protection, and CSRF logout enforcement |

## Snowflake IDs and Base62 — 25 October 2026

Replaced production sequence allocation with a 41/10/12-bit Snowflake generator. The fixed epoch is 25 October 2026 00:00 Asia/Singapore (24 October 16:00 UTC). SNOWFLAKE_WORKER_ID defaults to 0 and accepts 0–1023. Base62 and the public API remain unchanged. V5 preserves mappings and records the legacy ID floor, epoch, and worker timestamp reservations. Most allocation uses memory within up-to-one-second reservations; new reservations use an independent database transaction. This is not a fully database-independent ID service or a completed distributed deployment.

The final Maven verify passed 155 Surefire cases plus one Failsafe packaged restart case. Twenty new cases cover the fixed epoch and bit layout, worker bounds and identity separation, same-millisecond counters and overflow waiting, clock rollback/recovery, timestamp/lifetime bounds, Base62 length, reservation failures/renewal/restart waiting, concurrent same-worker reservations, independently committed reservations surviving an outer mapping rollback, epoch mismatch, legacy floor enforcement, and V5 legacy upgrade/exhaustion behavior. API creation asserts a current Snowflake timestamp and configured worker 11; the packaged crash/restart test checks persisted redirects, a later timestamp, and worker 7. Existing 48-request creation and click-counter concurrency checks also passed. These are correctness checks, not load tests.

V5 file-backed migration/reopen cases preserve old aliases (including leading zeros), destinations, owners, counters, epoch, and worker reservations, and include previously consumed sequence IDs in the floor. The old sequence helper now lives only under test sources for historical V2 checks. No existing migration was edited. The assistant did not open or migrate the development database.

The frontend build and all four live Chrome cases passed against an isolated in-memory packaged backend on port 8081, using worker 13 and Google login disabled. The backend and preview were stopped afterward. External destination redirects were not followed. Frontend component and isolated browser suites retain their preceding results and were not rerun. Existing screenshots show earlier code formats and were not refreshed.

Implementation and setup are in [snowflake.md](snowflake.md). Back up the stopped development database before first V5 launch. Actual multi-instance deployment, independent-machine clock/failover behavior, power-loss durability, load tests, security scans, hosted CI, real Google login, and actual-phone review remain unverified. No throughput improvement or random-looking public-code guarantee is claimed.

## Google accounts and click counts — 25 October 2026

Added optional Google OIDC authorization-code login with automatic local account creation, owner-scoped cursor history, server creation dates, atomic GET redirect counters, and CSRF-protected account creation/logout. V4 preserves legacy mappings as unowned with zero counts; a file-backed upgrade/reopen test verifies durable accounts, ownership, counts, and sequence state. HEAD/unknown-code requests do not increment counts; concurrent increments were checked. Direct API clients cannot choose an owner, and stale signed-in UI cannot silently create an unowned mapping after session expiry.

All backend checks and builds passed. Frontend tests verify separate guest/account histories, count refresh and pagination, logout/session changes, and ignoring late private responses. Isolated browser cases use mocked account state; the live packaged backend uses an isolated in-memory database with Google login disabled. Four live cases passed without following destination redirects externally. The session CSRF token was also tested with the actual security filter chain in MockMvc.

Guest desktop/mobile screenshots were refreshed against the real local backend. Account desktop/mobile previews were captured and visually inspected with explicitly mocked identities and counts; they do not demonstrate a Google login. Google Cloud OAuth credentials are not configured, so real consent, token exchange/validation with Google, and signed-in session/logout behavior remain manual checks. Setup and the exact callback URL are in [accounts.md](accounts.md). Sign-in stays unavailable until configured; guest shortening remains functional. This is functional verification, not a completed security scan or performance benchmark.

## Recent snips — 25 October 2026

Added a browser-local collection of the latest 20 successful creations, displayed beside the tool from 1,000px wide and below it on smaller screens. Entries provide Open/Copy/Remove and Clear history. The list uses localStorage, remains available in memory if storage fails, and does not create an account-history endpoint. Saved data is checked before rendering; the collection is memoized and writes happen only on history changes.

All 129 frontend tests, the build, 28 isolated browser cases, and three real-backend browser cases passed. The live check verified persistence on reload and an unchanged exact 302 redirect after clearing browser history. Desktop/mobile screenshots were refreshed and visually inspected, including `screenshots/history-desktop.png`. Tests covered blocked/quota/clear failures and a clear during an in-flight creation. Cross-tab notification was checked through a simulated storage event in a component test.

The real backend ran on port 8081 with a temporary in-memory database and external redirect following disabled. Backend source/schema were unchanged, so the full backend suite was not rerun for recent snips; the 123 backend checks above remain the preceding validation revision's result. Actual-phone/IME review, security scans, and performance measurements remain unverified. See [recent-snips.md](recent-snips.md) for scope and browser-storage limits.

Width follow-up: expanded the desktop history column from 280px to 340px. The production build and all 28 existing browser checks passed again. A separate Chrome spot check with 12 seeded entries verified that a localhost link with an 11-character code plus its external-link icon fits on one line at 1,000/1,024/1,280px viewport widths. Longer custom hosts and narrow screens retain wrapping. Backend/live checks were not rerun for this CSS change.

Scroll-containment follow-up: hidden status messages in unpositioned history cards were escaping the list's scroll container and extending the document height. Cards now establish their own containing block. The desktop layout also fits the available viewport height; the illustration shrinks while preserving the input/cutting alignment, and the list uses the remaining height. Smaller/shorter windows retain normal page flow without a nested history scrollbar. No global body overflow lock was added.

The build and existing 28 browser checks passed with this layout. Five new full-history regressions also passed (in an 11-case targeted history run), covering 1,000×700, 1,024×768, 1,280×720, 1,280×900, and 1,920×1,080 viewports. They seed 20 entries, verify the document fits both before and after creation, scroll the history, and check the outer page stays still. A separate 1,280×768 fixture preview was visually inspected. Earlier real-backend screenshots/live results remain from before this CSS follow-up; backend, unit, and live suites were not rerun.

Spacing follow-up: the desktop form now distributes spare space evenly around the illustration and submit action, reducing the large unused area below the button on tall windows. The build and a complete 33-case browser run passed. A 1,280×1,080 preview was visually inspected; the page still fits the viewport. Mobile layout and backend behavior were unchanged.

New creation validates HTTP(S), domain/TLD format, encoded characters, no raw whitespace, and at most 2,048 characters, before ID allocation. Invalid input returns 400 INVALID_URL; accepted URLs remain unchanged. The tests also verify missing/null input, control characters, malformed escapes, invalid Punycode, exact boundary behavior, and redirects for older over-limit mappings. The TLD snapshot is bundled; no DNS or destination HTTP request is made. See [url-validation.md](url-validation.md).

The first protocol-completion follow-up added https:// on blur/submit and passed the frontend and three live checks, with refreshed screenshots. The keyboard-entry follow-up now completes a bare hostname immediately once its first dot is typed or pasted. The latest frontend tests/build and 22 browser checks passed, including caret placement, deletion, editing in the middle after an equivalent bare-address replacement, and manual HTTP(S) entry. A component test checks composition completion. Blur/submit remain fallbacks. The backend source/contract is unchanged; the backend and live suites were not rerun for this keyboard-only follow-up. Actual-device keyboard/IME review remains manual.

The live checks used the packaged backend on port 8081 with a temporary in-memory database and disabled external redirect following. Desktop, mid-cut, mobile-result, and mobile-validation screenshots were refreshed. The standalone packaged restart test separately checked file persistence. These are assistant-run checks; actual-phone review, security scans, performance measurements, and hosted CI confirmation remain outstanding.

## Previous results — before the URL-validation update

| Check | Last recorded result | Boundary |
| --- | --- | --- |
| Backend Maven verify | 55 unit/API/migration cases and 1 packaged restart check passed | Isolated test databases; not rerun during the latest visual or documentation changes |
| Frontend component/API-client tests | 29 passed | 12 component and 17 client cases |
| Frontend production build | Passed | Rebuilt for the pixel cursor; later transparent-handle edit received an SVG syntax/color check |
| Isolated Chrome browser suite | 11 passed | Stubbed API; six viewport sizes, keyboard, clipboard, cutting interaction, reduced motion, branding, and confetti placement |
| Live Chrome browser suite | 2 passed | Temporary backend database, real clipboard and exact 302 Location; no external redirect following |

These historical results are from the Sniply visual update below and describe the earlier accept-any-string policy. The current validation policy and counts are summarized above; the output-length comparison remains absent.

## Pixel scissors cursor follow-up

Added a native 32×32 SVG cursor for fine pointers with hover support. An earlier Chrome spot check confirmed cursor CSS on the page, links, and buttons, text editing in the input, SVG decoding, and the touch-only fallback; the frontend build passed. After Amanda requested removal of the pink/yellow fills, the handles were made transparent and the updated SVG passed XML parsing and a check that those fills were absent. Browser checks were not rerun after that final asset edit. Native cursors are not visible in the documentation screenshots.

## Earlier backend automated tests — 24 October 2026

That revision's Maven `verify` run passed with 56 backend checks and no failures or errors: 55 Surefire tests, followed by one packaged-application restart integration test through Failsafe. The latest suite has grown; its counts are recorded above.

- Base62EncoderTest: 14 tests, 0 failures, 0 errors.
- SequenceMigrationTest: 5 tests, 0 failures, 0 errors.
- ShortLinkApiTest: 9 tests, 0 failures, 0 errors.
- ShortLinkServiceTest: 27 tests, 0 failures, 0 errors.
- ShortLinkRestartIT: 1 test, 0 failures, 0 errors.

At that revision, `mvn test` ran the first 55 checks. `mvn verify` also built the executable JAR and ran the restart integration check. GitHub's backend workflow still invokes `verify`, so the next hosted run includes the updated suite and restart check.

## Real-input scissors interaction — 24 October 2026

Removed the window caption and the sample URL graphic. The actual native text field is now positioned at the scissors' cutting point. The character rises to snip the entered box; temporary clipped visual halves show the submitted text while the real field keeps its DOM identity, value, and focus. Editing cancels the field effect immediately. Results remain independent of animation completion, and reduced motion disables the effect.

- Component/API-client tests: 29 passed (12 component and 17 API-client cases).
- Browser checks: 11 passed across phone, tablet, desktop, and landscape viewports, including direct field clicks, persistent input identity/focus, editing during animation, replay, and reduced motion.
- Frontend build and both real-backend browser checks passed using an isolated in-memory database. No backend source or development database was changed.
- Refreshed desktop/mobile screenshots and captured `screenshots/input-cutting-desktop.png` at a controlled mid-cut frame for visual inspection. Mobile edge decorations were adjusted to avoid clipped shapes.

## Whimsical scissors UI — 24 October 2026

Replaced the descriptive landing page and three-step section with a compact, icon-rich tool inspired by Amanda's scissors reference. The illustration is original SVG code, with soft blue browser chrome, cream background, rounded type, and a character holding oversized scissors. No new dependencies or backend changes were introduced.

- Component/API-client tests: 28 passed (11 component and 17 API-client cases).
- Frontend production build: passed.
- Isolated Chrome browser checks: 10 passed, covering 320/360/390/768/1280px widths, 844×390 landscape, expanded original-destination wrapping, keyboard submission, clipboard denial, animation replay, immediate availability of fast API results during animation, and reduced motion.
- Real-backend browser checks: 2 passed against an isolated in-memory H2 database on port 8081. Verified creation, clipboard contents, exact redirect Location without following it, and the existing policy allowing generated output longer than its input.
- Refreshed and visually inspected `screenshots/landing-desktop.png` and `screenshots/result-mobile.png`.

The finite 1.1-second cutting scene uses CSS transforms/opacity and replays per submit. It does not delay requests or results, has no idle loop, and respects reduced motion. The SVG is memoized to avoid redraws for typing/clipboard state. No frame-rate or real-device smoothness benchmark is claimed; actual-phone, Safari, zoom, and screen-reader reviews remain manual items. Security and performance checks remain deferred.

## Store-as-submitted policy — 24 October 2026

At Amanda's request, removed destination validation, whitespace trimming, and output-length comparison from the backend and matching frontend checks. The application assumes submitted strings are valid; it has never fetched websites to check existence. Configuration, generated-code integrity, and JSON parsing checks remain.

- Replaced the old validation tests with tests for exact string preservation and acceptance of blank, missing-scheme, short, and previously over-limit input.
- Flyway V3 changes original_url to CLOB. Real API tests verify a 5,000-character path is stored intact and a short input is saved even when its generated URL is longer.
- Backend: 55 unit/API/migration tests plus the packaged restart test passed; executable JAR packaging passed.
- Frontend: 27 component/API-client tests and the production build passed.
- Browser: all 6 isolated checks and both real-backend checks passed, including acceptance of longer generated output for a short destination.
- All backend checks used temporary or isolated test databases. Development data was not migrated or changed.

The earlier milestone records below describe historical validation/shortening policies and counts. They do not override the current store-as-submitted behavior. User review, hosted CI confirmation, security scans, and performance checks remain separate work.

## Sequence-ID revision — 24 October 2026

- Replaced random code generation with an H2 sequence and Base62 encoder; codes may be 1–11 characters.
- Verified known encodings and length transitions, the full positive-long range, rejection of negative values, and exact allocated-ID/code persistence.
- Verified 48 concurrent creations on six threads produce distinct mappings, duplicate assigned IDs cannot overwrite existing rows, and code uniqueness remains enforced. This is a correctness test, not a load/performance result.
- Tested fresh and legacy file-backed migrations, preservation of aliases and destinations, reservation above legacy primary keys and code values, database reopen without sequence reset, non-reuse after rollback, and safe failure on sequence exhaustion.
- A manual immediate-stop check initially lost a just-acknowledged mapping with H2's default delayed commit flushing. Application connections now run `SET WRITE_DELAY 0`. `ShortLinkRestartIT` launches the packaged application with a temporary file database, forcibly stops it immediately after the POST response, restarts it, and verifies both the exact saved redirect and a larger subsequent allocation. This check passed after the configuration change. Hardware/power-loss durability and performance impact are not established by this test.
- Frontend compatibility: all 28 component/API-client tests and the frontend build passed; both live browser checks passed against the new packaged backend with an isolated file-backed H2 database on port 8081. Redirect following remained disabled.
- No development database was opened or migrated during this work. First startup against `backend/data/` will apply the documented migration; back up that stopped database first.

See `backend-design.md` for design decisions and corrections to the Copilot analysis. Amanda's review of this revision remains pending. Security and performance checks remain deferred; no hosted GitHub result or distributed capacity is claimed.

## Earlier live HTTP smoke test

Started the backend using the Maven spring-boot:run goal and an isolated file-based H2 database. A real HTTP POST returned 201; following the generated local route with redirect following disabled returned 302 and the exact original Location including query string and fragment.

## Earlier packaging follow-up

The earlier milestone reported a missing main manifest attribute on direct JAR execution. During the frontend milestone, Maven `verify` completed with dependency downloads enabled, the Spring Boot repackage goal produced an executable archive, and `java -jar target/url-shortener-0.0.1-SNAPSHOT.jar` started successfully. No backend source or POM changes were needed. The earlier failure was not reproduced in this run; no deployment is claimed.

## Frontend milestone — 24 October 2026

Verified locally with Node 20.19.5, React 19.3.1, Vite 8.3.5, Vitest 4.1.12, Playwright 1.64.1, and installed headless Chrome. GitHub CI is configured for Node 24 and Java 25; the hosted run remains pending.

- Frontend component/API-client tests: 28 passed (10 component cases and 18 client/validation cases).
- Frontend production build: passed.
- Isolated browser suite: 6 passed, including 360/390/768/1280px layouts with a long destination, keyboard validation, and clipboard denial. The API was deliberately stubbed in this suite.
- Live browser suite: 2 passed against the real packaged backend on port 8081 with an isolated in-memory H2 database. Checked real creation, shorter output, actual clipboard contents, exact 302 Location with query and fragment, and backend validation feedback. Redirect following was disabled; no destination website was fetched.
- Backend `verify`: 28 tests passed and packaging completed.
- Desktop and mobile screenshots were captured and visually inspected: `screenshots/landing-desktop.png` and `screenshots/result-mobile.png`.

These are assistant-run checks. Amanda has not yet reviewed the test implementation. See `testing.md` for review order, commands, and limitations.

The user reports backend verification complete. The assistant did not repeat a process-restart disk-persistence check during the frontend milestone; the live browser checks used an isolated in-memory database.

## Sniply visual update — 24 October 2026

Renamed the page and browser metadata to Sniply. The input is labelled **Put your long URL here!** with a decorative curly arrow; confetti and cutting sparks sit below the field, and the character's shirt marks were removed.

- Frontend tests: 29 passed; production build passed.
- Isolated Chrome browser tests: 11 passed, including six viewport sizes from 320px wide through desktop and landscape. These also check the Sniply title and that confetti is below the input.
- Live Chrome browser tests: 2 passed using the packaged backend on port 8081 and a temporary in-memory database. Creation, clipboard contents, and the exact redirect Location passed; redirects were not followed externally.
- Refreshed and visually inspected the desktop, mobile, and mid-cut screenshots in `docs/screenshots/`.

These are assistant-run functional and visual checks; they do not measure animation frame rate or replace Amanda's review. The backend source was unchanged and its full test suite was not rerun for this visual update.

## Not yet verified

Actual phone/mobile Safari, browser zoom, on-screen keyboard and screen-reader review, a clean checkout, hosted GitHub Actions, security scanning, stress/load tests, and production deployment remain future checks. Automated responsive checks were performed in desktop Chrome at the specified viewport widths. Security and performance work is explicitly deferred to a later milestone.
