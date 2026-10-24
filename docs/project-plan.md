# Sniply — STB URL Shortener Assessment Plan

Submission deadline: Tuesday 27 October 2026 at 6pm Singapore time  
Planning date: 24 October 2026

Current policy update (25 October 2026): at Amanda's request, validate new destination URLs for HTTP(S), domain/TLD format, correct percent escapes, absence of raw whitespace, and a 2,048-character maximum. Store accepted URLs unchanged and create mappings even when the generated URL is equal in length or longer. This supersedes the accept-any-string policy from 24 October. Website availability is not checked. See [url-validation.md](url-validation.md).

## Purpose and recommended scope

Build a small, complete URL shortener that demonstrates full stack development, clear engineering decisions, automated tests, and willingness to learn. Use Spring Boot for the backend and React for the frontend. Mobile support means a responsive website; a separate mobile application is unnecessary.

Complete the required features first. Introduce basic security and a lightweight AI prompting workflow from the beginning. Perform security scans and load testing after a working version exists, leaving time to fix findings. This is a plan, not a record of completed implementation or test results.

### Current implementation and remaining work

The sequence/Base62 backend, Flyway V1–V3 migrations, file-based H2 persistence, Sniply frontend, scissors interaction, frontend/backend tests, and GitHub Actions workflow are implemented. Recorded local results are in [verification.md](verification.md); those results do not establish that user review or hosted CI has completed.

Next: review the code and test assertions, check the UI on an actual phone, and confirm the latest GitHub checks. Security scanning/hardening and performance measurements remain deferred to their own milestones. Finish with a clean-checkout check and submission review. Keep the final checklist unchecked until its complete requirement has been confirmed.

## 1 Requirements and completion criteria

| Requirement | Completion criteria |
| --- | --- |
| Web application | Landing page loads and communicates what the tool does |
| URL input | Labelled text box validates and submits accepted URLs unchanged |
| Destination policy | HTTP(S), valid recognized domain/TLD, encoded special characters, no raw whitespace, maximum 2,048 characters; no reachability check |
| Shorten button | Clicking the button or pressing Enter submits the form |
| Feedback view | Displays a clickable short URL and copy action |
| Output policy | Create mappings even when generated URLs are equal in length or longer |
| Working short links | Opening a saved short link redirects to the original URL |
| Unit tests | Meaningful backend and frontend tests run with documented commands |
| User friendly UI | Clear loading, success, and request-failure states |
| Mobile responsiveness | No horizontal overflow; controls remain usable on small screens |
| Code quality | Clear responsibilities, consistent naming, readable errors, minimal duplication |
| Submission | GitHub repository includes source, setup instructions, tests, and limitations |

Accepted destinations are stored verbatim after syntax validation. Format/TLD validation does not prove that the domain is registered, the website is available, or the destination is safe.

## 2 Technology choices

| Component | Proposed choice | Reason |
| --- | --- | --- |
| Frontend | React with Vite | Small interactive interface and straightforward setup |
| Language | Java 25 backend; JavaScript frontend | Matches the implemented Maven and React projects |
| Styling | CSS | Sufficient for a polished responsive single page |
| Backend | Spring Boot with Maven wrapper | Demonstrates Java API and backend skills |
| Persistence | File-based H2 with Spring Data JPA | Simple local setup and persistence across restarts |
| Link IDs | Shared H2 sequence followed by Base62 encoding | Distinct allocated numbers and compact variable-length public codes |
| Schema changes | Flyway migrations; Hibernate schema validation | Explicit upgrades that retain existing development links |
| Backend tests | JUnit and Mockito | Test rules independently of the database |
| API integration tests | Spring test support with a separate test database | Verify HTTP behaviour and persistence together |
| Frontend tests | Vitest and React Testing Library | Verify user interactions and feedback |
| Performance tests | k6 | Repeatable API load scenarios and measurable thresholds |
| Repository automation | GitHub Actions | Run build and unit tests on pushes and pull requests |

Use supported stable releases compatible with each other and document the actual Java and Node prerequisites. Do not upgrade dependencies without rerunning relevant checks. H2 is a deliberate assessment simplification; discuss a production database as a future improvement.

## 3 End to end behaviour

1. User opens the landing page and enters a long URL.
2. React submits it to the backend.
3. Backend validates the submitted URL before ID allocation; invalid values return 400 INVALID_URL. Accepted input is not trimmed or rewritten.
4. A database-backed allocator obtains a unique positive integer from the shared H2 sequence; a separate Base62 encoder converts it to a compact code.
5. Service constructs the generated URL from the configured public base URL without comparing lengths.
6. Database stores the allocated ID, code, original destination, and timestamp. The primary key and code uniqueness constraint remain authoritative.
7. UI displays the result with Open and Copy actions.
8. GET requests to the short link return a redirect to the saved destination.

Keep the original destination semantics, including its path, query string, and fragment. Avoid aggressive normalisation that changes case-sensitive paths or parameter values.

## 4 Backend outline

### API contract

| Endpoint | Success | Error examples |
| --- | --- | --- |
| POST /api/urls | 201 with unchanged accepted originalUrl and generated shortUrl | 400 INVALID_URL for destination policy; 400 INVALID_REQUEST for malformed JSON; 500 storage/allocation failure |
| GET /s/{code} | 302 with Location header | 404 unknown code |

Use a consistent JSON error structure, such as code and message. Display a friendly unknown-link page for browser users where practical. Choose one repeated-input policy and document it; generating a new mapping each time is sufficient for this scope.

### Data model

- id: positive BIGINT allocated from a database sequence before insertion; the primary key.
- code: Base62 encoding of the allocated ID for new links, with a database unique constraint and indexed lookup. Existing legacy aliases retain their original values.
- originalUrl: saved destination.
- createdAt: creation timestamp.

### Responsibilities

- Controller: request and response handling.
- Service: validate before coordinating ID allocation, encoding, verbatim destination storage, and lookups.
- UrlValidator: enforce the documented format/TLD/length policy using a bundled IANA snapshot, with no DNS or HTTP lookup.
- LinkIdAllocator: the ID-source boundary; DatabaseLinkIdAllocator uses the shared H2 sequence.
- Base62Encoder: deterministic integer encoding using 0–9, A–Z, and a–z; no database access or randomness.
- Repository: database access.
- DTOs: request and response shapes.
- Exception handler: consistent errors without internal stack traces.
- Configuration: public base URL, database settings, and allowed frontend origin when needed.

### Revised ID allocation decision — 24 October 2026

Use a database sequence followed by Base62 encoding, replacing the original random seven-character generator and retry loop. New codes are variable length (1–11 characters for positive Java longs), case-sensitive, and unpadded. Fresh databases begin at ID 1. Database failures propagate as server errors; there is no retry loop for code collisions or pre-insert existence query.

Keep the mapping table and unique constraints. Redirects look up the exact stored code rather than decoding it, so legacy links, including leading-zero aliases, remain usable. Keep the current HTTP endpoints and JSON response shapes.

Flyway now owns versioned H2 schema changes; Hibernate validates the schema instead of modifying it. V1 adopts the original table; V2 widens the code column, replaces identity-column allocation with a named sequence, and starts it above both all existing primary keys and the numeric values of all legacy codes. The one-time scan prevents overlap with old aliases. Migration history and sequence state survive restarts; never reset a live sequence. Back up the stopped file database before its first migrated launch. This migration supports the original seven-character legacy schema, not arbitrary custom schemas.

This is a database-coordinated design, not a claim that the application reproduces Bitly's internal implementation or is already distributed. The existing backend already had a service boundary and database-enforced uniqueness. Random generation with a unique constraint can also scale. Base62 supplies compact representation; the sequence supplies unique numbers. Increasing allocated IDs need not produce completion-ordered responses. Invalid destinations are rejected before allocation; failed inserts or rollbacks after allocation can leave gaps.

Sequential public codes are enumerable. They are not credentials or authorization. The current embedded H2 file is still a single-instance assessment choice. A later deployment with multiple application instances would need a shared database and suitable allocator implementation; Redis, Snowflake, coordination services, click analytics, expiry, and status management remain outside this change. No performance improvement is claimed until measured. See [backend design](backend-design.md) for examples and migration details.

Configure H2 connections with `SET WRITE_DELAY 0` so committed writes do not retain the default 500 ms flush delay. Include an immediate-stop/restart smoke check with an isolated file database. This is a persistence correctness check, not a performance test or a power-loss durability guarantee.

### Input decisions

- Validate new URLs according to [url-validation.md](url-validation.md), including HTTP(S), recognized domain/TLD, percent escapes, no raw whitespace/controls, and a 2,048-character maximum.
- Store accepted input exactly; do not trim or normalize it. Reject credentials, localhost/IP-only hosts, and raw Unicode; support encoded characters and Punycode domains.
- Do not check website existence or availability during creation.
- Do not compare generated URL length with input length.
- Keep Flyway V3's CLOB column and existing mappings. Enforce the new creation-time limit without a schema migration or redirect-time revalidation.
- Mirror the policy in the frontend, show accessible field errors without starting the scissors animation, and allow correction/retry. Keep network, malformed-request, and clipboard error feedback.
- Redirects still need a usable HTTP Location header; an unusable saved destination can fail when opened. Creation does not guarantee a usable redirect.

## 5 Frontend and mobile outline

Use one compact, whimsical scissors-themed page inspired by Amanda's reference: soft blue browser chrome, cream background, rounded type, an original character holding oversized scissors, and small decorative icons. Keep copy brief and omit the previous explanatory paragraphs and three-step section. Include a labelled input, clear action, **Snip my link** button, request/error feedback, and a compact result with Copy, Open, and expandable Original link actions.

Use **Sniply** branding. Label the input **Put your long URL here!** with a decorative curly arrow pointing down to the field. Keep confetti below the input, including during the cutting animation, and keep the character's shirt plain.

Complete an omitted protocol as https:// during bare-hostname keyboard entry/paste, with blur/submission as a fallback and display it in the textbox before validation/creation. Preserve explicit schemes and encoded path/query/fragment text. Handle bare hostnames with ports and protocol-relative addresses; leave blank input blank. Include the added prefix in the 2,048-character limit. Direct backend API requests still require an explicit HTTP(S) URL.

Use a native 32×32 pixel-art scissors cursor for fine pointers with hover support. Keep its handle centers transparent, retain the text cursor in editable fields, preserve pending-state feedback, and leave touch-only behavior unchanged. Use CSS cursor fallbacks rather than JavaScript mouse tracking.

On every submission, replay a finite SVG/CSS cutting animation independently of the network request. Use transforms and opacity for scene motion; never wait for the animation before sending the request or displaying its response. Do not loop the scene while idle. Respect reduced-motion preferences by disabling decorative animation. Keep artwork and controls responsive, with no animation-library dependency.

Place the real editable URL field at the scissors' cutting point instead of a simulated URL graphic. Remove the "little link studio" window caption. Animate the character lifting the scissors to cut the entered field, then show the real generated link below. Keep a single native input mounted throughout submission, preserve its value/focus, and immediately restore the field appearance if the user resumes editing during the effect. Any temporary visual halves must be non-interactive and hidden from screen readers.

- Disable duplicate submissions while a request is pending.
- Preserve the user's input after errors and allow retry.
- Handle network failures and clipboard failures gracefully.
- Stack controls on narrow screens and keep tap targets comfortably sized.
- Wrap long URLs without causing horizontal scrolling.
- Support Enter submission, keyboard navigation, visible focus, readable contrast, and screen-reader announcements for results and errors.
- Test approximate widths of 320, 360, 390, 768, and 1280 pixels, plus a landscape viewport and an actual phone if available.
- Check portrait and landscape, browser zoom, and the on-screen keyboard.

## 6 Lightweight prompt engineering workflow

Start this before coding. Treat it as a repeatable way to use an AI assistant during development, not an AI feature inside the URL shortener. No LLM API, agent framework, or chatbot is needed. Check any assessment rules about AI assistance and describe your use honestly.

Use this simple prompt structure:

1. Context: the application, current files, and relevant decisions.
2. Task: one bounded change or review.
3. Constraints: technologies, scope, security rules, and things that must remain compatible.
4. Acceptance criteria: observable behaviour and edge cases.
5. Output: explanation, patch, test suggestions, or review findings.
6. Verification: independently inspect the result and run meaningful checks.

### Reusable example

> Context: I am building Sniply with Java 25/Spring Boot and React. POST /api/urls validates an originalUrl and returns a shortUrl. Accepted URLs are stored unchanged. Generated output need not be shorter. The public base URL is configurable.
>
> Task: Review mapping creation and exact input preservation. Do not change unrelated files.
>
> Constraints: Do not fetch destination URLs, add dependencies, introduce authentication, or change destination query parameters. Explain any uncertainty.
>
> Acceptance criteria: Enforce the documented HTTP(S), domain/TLD, encoding, and 2,048-character policy before allocation. Reject whitespace and malformed input. Preserve accepted query strings and fragments exactly, and keep generated codes unique.
>
> Output: List findings with reasons, propose the smallest changes, and suggest tests.
>
> Verification: I will inspect the changes, run the tests, and check valid and invalid requests manually.

Keep a concise docs/ai-usage.md with a few useful prompts, what you accepted or rejected, how you checked the output, and what you learned. Do not put secrets, credentials, or private employer material into prompts. You should be able to explain every submitted change. Time budget: about 30 minutes initially, then brief notes during development.

## 7 Security implementation and scanning

### Build basic protections early

- Current creation-time destination validation is documented in url-validation.md. Review total request-body limits in the later security milestone; a URL length rule is not a body-size limit.
- Never fetch or preview a submitted destination on the server. This avoids introducing server-side request forgery through a destination-fetch feature.
- Use repository parameter binding instead of constructing SQL from input.
- Render URLs as text and safe link attributes; do not insert user input as HTML.
- Build short links from a configured trusted base URL rather than an untrusted Host header.
- Keep secrets and local database files out of Git. Use environment variables and a non-secret example configuration.
- Return generic server errors and log useful diagnostics without full destination URLs or sensitive query strings.
- Prefer a same-origin deployment or development proxy; otherwise restrict CORS to the intended frontend origin. CORS is not authentication or abuse prevention.
- Disable the H2 console outside an explicit local development profile. Do not expose database or sensitive management endpoints publicly.
- If deployed, use HTTPS and verify suitable response headers. Apply HSTS only in an HTTPS deployment.

Optional after the core works: add a simple limit to URL creation requests, return 429 with clear feedback, and test it. An in-memory limiter has single-instance and restart limitations; document those. Authentication is outside the brief.

### Scan after the first working version

| Check | Proposed approach | Evidence |
| --- | --- | --- |
| Frontend dependencies | npm audit | Date, findings, relevant remediation, remaining issues |
| Java dependencies | GitHub Dependabot alerts; add OWASP Dependency-Check only if time permits | Findings reviewed against actual dependency usage |
| Source analysis | GitHub CodeQL if available for the repository | Reviewed Java and JavaScript/TypeScript findings |
| Secrets | Enable available GitHub secret scanning and push protection | Confirm configuration and inspect accidental secrets |
| Running app | Optional ZAP baseline scan against your own local/test application | Alert review and fixes; note route coverage |

GitHub feature availability depends on repository visibility and account settings. Do not spend deadline time fighting unavailable tooling. ZAP baseline uses crawling and passive analysis; it does not prove the application is secure and may miss API routes it never exercises. Review findings instead of blindly suppressing them or applying breaking upgrades.

Reserve about 60 to 90 minutes for initial scans and fixes. Keep commands, tool versions, results, and known limitations in docs/security.md. A scan with no findings is not a security guarantee.

## 8 Load testing and response time tracking

Mobile responsiveness and response time are separate concerns. Verify the UI across screen sizes, and measure backend latency and capacity with repeatable API tests.

### Metrics

- Request throughput: requests per second.
- p50 and p95 latency: typical response time and the time within which 95 percent of requests complete.
- Unexpected error rate and failed correctness checks.
- CPU and memory during the run, using lightweight local monitoring if available.
- Recovery after increased traffic.

Log response duration, status, and route pattern if useful; avoid logging full URLs or making a separate metric label for every short code. A full monitoring dashboard is optional and unnecessary for the assessment.

### Test progression

| Test | Suggested initial profile | Goal |
| --- | --- | --- |
| Smoke | 1 virtual user for 30 seconds | Verify the script and assertions |
| Normal load | Ramp to 10 virtual users and hold for 2 minutes | Establish a baseline |
| Higher load | Ramp to 25, then 50 virtual users in short stages | Observe increasing latency and errors |
| Stress and recovery | Increase beyond the normal profile within local resource limits, then reduce | Find degradation and check recovery |

These are starting scenarios, not STB capacity requirements. Virtual users do not imply a fixed request rate; define pacing and report achieved throughput. Cap runs to avoid exhausting the machine or filling the database.

Test creation and redirects separately first, then optionally run a documented mixed workload such as 20 percent creation and 80 percent redirects. Use sufficiently long input URLs and isolated test data. Include concurrent creation to exercise uniqueness handling. Clean up test data afterward.

For redirects, disable automatic redirect following and check the 302 status and Location header. Otherwise tests may generate traffic to third-party destinations and measure their performance. Test only your own application and infrastructure you are authorised to test.

Example provisional normal-load goals: p95 under 500 ms for creation, p95 under 200 ms for redirect lookup, and under 1 percent unexpected errors. These are self-selected local goals, not promised results or production SLAs. Configure k6 success handling so expected 302 responses count as success. Keep malformed-request errors and any future expected rate-limit 429 responses separate from unexpected failures.

Record the command, application commit, machine/runtime details, dataset size, warm-up, duration, virtual users, pacing, achieved throughput, endpoint latency, error rate, and limitations in docs/performance.md. Report actual measurements honestly. Repeat after a relevant fix, not endlessly. Local tests do not establish production capacity.

Time budget: about 60 to 90 minutes for a useful initial script and report; deeper stress testing is optional.

## 9 Test checklist

### Backend unit tests

- Exact preservation of accepted URLs, including encoding, query order, case, and fragments; valid short URLs remain accepted.
- Rejection of missing schemes, invalid domains/TLDs, whitespace/controls, malformed escapes, null/empty input, and over-limit input before ID allocation or insertion.
- Acceptance at exactly 2,048 characters and rejection at 2,049; existing over-limit mappings still redirect.
- Base62 known values, digit-length boundaries, negative input rejection, and the full positive-long range.
- Store the allocated ID, its encoding, and the unmodified submitted destination.
- Allocator and insert failures propagate without retries or false success.
- Known-code lookup and unknown-code behaviour.

### Integration tests

- POST returns the agreed response and persists the mapping.
- GET returns the correct redirect status and exact Location.
- Invalid requests return consistent errors.
- Database uniqueness is enforced.
- Concurrent creation produces distinct IDs/codes; duplicate assigned IDs cannot overwrite existing destinations.
- Fresh and legacy H2 schemas migrate correctly; aliases and sequence state survive database reopen.
- Rolled-back allocations are not reused and exhausted sequences fail instead of cycling.
- Packaged-application restart check runs after JAR creation during `mvn verify`: stop the process immediately after a successful POST, restart with the same temporary file database, and verify the saved redirect and advancing sequence.
- Separate test database does not modify local development data.

### Frontend tests and manual checks

- Form submission, field validation and correction, loading, success, malformed-response handling, and server failure states.
- Copy success and failure feedback.
- Keyboard submission and accessible labels.
- Desktop and mobile layouts, long URL wrapping, and retry behaviour.
- Open a short link in a new tab and after an application restart.

Include required unit tests explicitly; load tests and security scans do not replace them.

## 10 Repository and delivery outline

The current repository contains backend/, frontend/, docs/, a root README.md and .gitignore, and .github/workflows/checks.yml. The workflow runs backend verify and frontend tests/build/browser checks. Confirm the latest hosted run after pushing. Add tests/load/ and security/performance reports when those milestones begin; they are not implemented yet.

The README should cover the app, prerequisites, exact run and test commands, environment settings, persistence, API examples, architecture, validation decisions, desktop/mobile screenshots, known limitations, and links to AI usage, security, and performance notes. A clean checkout should run without private local files.

## 11 Initial timeline (Amanda: I will be doing as much as I can in one-two days instead)

| Date | Work and order | Completion checkpoint |
| --- | --- | --- |
| Sat 24 Oct | Confirm scope; create repository; write prompt template; implement API, database, destination storage, redirects, and unit tests; add basic security as code is written | Can create and follow a short URL; data survives restart |
| Sun 25 Oct | Build React interface and mobile styles; connect API; add frontend tests; establish CI; run initial dependency/source scans | Complete user journey works; scans started with time left to fix findings |
| Mon 26 Oct morning | Fix functional/security findings; finish accessibility and mobile checks; optionally run ZAP baseline | Stable candidate with required tests passing |
| Mon 26 Oct afternoon | Run k6 smoke and normal-load tests; add a bounded higher-load/recovery test if time allows; fix material issues and write reports | Repeatable test scripts and honest documented results |
| Tue 27 Oct morning | Test a clean clone; rerun relevant checks; finish README and AI learning notes; inspect GitHub contents and access | Submission ready by about 3pm Singapore time |
| Tue 27 Oct before 6pm | Send repository link using the requested email process; verify submission | Submitted before the deadline |

Protect a submission buffer. If behind, cut optional ZAP, elaborate monitoring, deep stress testing, and deployment first. Keep required functionality, unit tests, responsive UI, the agreed destination policy, and setup documentation. A small normal-load test and clear limitation note are better than unfinished infrastructure. This original timeline is planning guidance; use the current implementation summary and verification record for actual progress.

## 12 Final submission checklist

- [ ] Required user journey works, including real redirects.
- [ ] Submitted strings are preserved; mapping creation does not require shorter output.
- [ ] Unit tests pass and frontend/backend builds succeed.
- [ ] Mobile and keyboard checks completed.
- [ ] Core security protections implemented and findings reviewed.
- [ ] Performance results identify the tested environment and limitations.
- [ ] AI-assisted work is understood, verified, and described honestly.
- [ ] README commands work from a clean checkout.
- [ ] No secrets, generated database files, or unnecessary build files committed.
- [ ] Repository is accessible to reviewers; do not make it public if assessment confidentiality rules prohibit this.
- [ ] All required source and documentation pushed to GitHub.
- [ ] Submission email sent before 27 October 2026 at 6pm Singapore time.

## Reference documentation

- Spring REST guide: https://spring.io/guides/gs/rest-service/
- React project setup: https://react.dev/learn/build-a-react-app-from-scratch
- GitHub repository security: https://docs.github.com/en/code-security/getting-started/quickstart-for-securing-your-repository
- ZAP baseline scan: https://www.zaproxy.org/docs/docker/baseline-scan/
- k6 metrics: https://grafana.com/docs/k6/latest/using-k6/metrics/
- k6 thresholds: https://grafana.com/docs/k6/latest/using-k6/thresholds/
- k6 options including redirects: https://grafana.com/docs/k6/latest/using-k6/k6-options/reference/
