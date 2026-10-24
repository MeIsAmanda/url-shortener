# Project verification

Verified on 24 October 2026 with Java 25 and Spring Boot 4.1.2.

## Automated tests

The complete Maven test run passed with 28 tests and no failures or errors.

- ShortLinkApiTest: 3 tests, 0 failures, 0 errors.
- ShortLinkServiceTest: 7 tests, 0 failures, 0 errors.
- UrlValidatorTest: 18 tests, 0 failures, 0 errors.

## Live HTTP smoke test

Started the backend using the Maven spring-boot:run goal and an isolated file-based H2 database. A real HTTP POST returned 201; following the generated local route with redirect following disabled returned 302 and the exact original Location including query string and fragment.

## Packaging follow-up

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
