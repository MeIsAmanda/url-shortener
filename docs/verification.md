# Project verification

Verified on 24 October 2026 with Java 25 and Spring Boot 4.1.2.

## Automated tests

The current Maven `verify` run passed with 56 backend checks and no failures or errors: 55 Surefire tests, followed by one packaged-application restart integration test through Failsafe.

- Base62EncoderTest: 14 tests, 0 failures, 0 errors.
- SequenceMigrationTest: 5 tests, 0 failures, 0 errors.
- ShortLinkApiTest: 9 tests, 0 failures, 0 errors.
- ShortLinkServiceTest: 27 tests, 0 failures, 0 errors.
- ShortLinkRestartIT: 1 test, 0 failures, 0 errors.

`mvn test` runs the first 55 checks. `mvn verify` also builds the executable JAR and runs the restart integration check. GitHub's existing backend workflow invokes `verify`, so it includes that check automatically on the next hosted run.

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

## Not yet verified

Actual phone/mobile Safari, browser zoom, on-screen keyboard and screen-reader review, a clean checkout, hosted GitHub Actions, security scanning, stress/load tests, and production deployment remain future checks. Automated responsive checks were performed in desktop Chrome at the specified viewport widths. Security and performance work is explicitly deferred to a later milestone.
