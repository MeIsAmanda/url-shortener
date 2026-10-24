# STB URL Shortener Assessment Plan

Submission deadline: Tuesday 27 October 2026 at 6pm Singapore time  
Planning date: 24 October 2026

## Purpose and recommended scope

Build a small, complete URL shortener that demonstrates full stack development, clear engineering decisions, automated tests, and willingness to learn. Use Spring Boot for the backend and React for the frontend. Mobile support means a responsive website; a separate mobile application is unnecessary.

Complete the required features first. Introduce basic security and a lightweight AI prompting workflow from the beginning. Perform security scans and load testing after a working version exists, leaving time to fix findings. This is a plan, not a record of completed implementation or test results.

## 1 Requirements and completion criteria

| Requirement | Completion criteria |
| --- | --- |
| Web application | Landing page loads and communicates what the tool does |
| Long URL input | Labelled text box accepts HTTP and HTTPS URLs |
| Valid URLs only | Backend rejects invalid input; frontend provides helpful feedback |
| Shorten button | Clicking the button or pressing Enter submits the form |
| Feedback view | Displays a clickable short URL and copy action |
| Shorter output | Complete returned URL is strictly shorter than the trimmed input |
| Working short links | Opening a saved short link redirects to the original URL |
| Unit tests | Meaningful backend and frontend tests run with documented commands |
| User friendly UI | Clear loading, success, validation, and failure states |
| Mobile responsiveness | No horizontal overflow; controls remain usable on small screens |
| Code quality | Clear responsibilities, consistent naming, readable errors, minimal duplication |
| Submission | GitHub repository includes source, setup instructions, tests, and limitations |

Assumption: a valid URL means a correctly formed HTTP or HTTPS URL with a hostname. It does not mean the destination has been visited or verified as safe. A URL shortener can be misused for phishing; syntax validation alone does not prevent that.

## 2 Technology choices

| Component | Proposed choice | Reason |
| --- | --- | --- |
| Frontend | React with Vite | Small interactive interface and straightforward setup |
| Language | JavaScript or TypeScript | Choose based on confidence and available learning time |
| Styling | CSS | Sufficient for a polished responsive single page |
| Backend | Spring Boot with Maven wrapper | Demonstrates Java API and backend skills |
| Persistence | File-based H2 with Spring Data JPA | Simple local setup and persistence across restarts |
| Backend tests | JUnit and Mockito | Test rules independently of the database |
| API integration tests | Spring test support with a separate test database | Verify HTTP behaviour and persistence together |
| Frontend tests | Vitest and React Testing Library | Verify user interactions and feedback |
| Performance tests | k6 | Repeatable API load scenarios and measurable thresholds |
| Repository automation | GitHub Actions | Run build and unit tests on pushes and pull requests |

Use supported stable releases compatible with each other and document the actual Java and Node prerequisites. Do not upgrade dependencies without rerunning relevant checks. H2 is a deliberate assessment simplification; discuss a production database as a future improvement.

## 3 End to end behaviour

1. User opens the landing page and enters a long URL.
2. React submits it to the backend.
3. Backend trims surrounding whitespace and validates the input.
4. Service generates a random alphanumeric code and constructs the complete short URL from a configured public base URL.
5. Service checks that the complete output is strictly shorter than the input.
6. Database stores the code and original destination.
7. UI displays the result with Open and Copy actions.
8. GET requests to the short link return a redirect to the saved destination.

Keep the original destination semantics, including its path, query string, and fragment. Avoid aggressive normalisation that changes case-sensitive paths or parameter values.

## 4 Backend outline

### API contract

| Endpoint | Success | Error examples |
| --- | --- | --- |
| POST /api/urls | 201 with originalUrl and shortUrl | 400 invalid or too-short input; 429 if a rate limit is implemented |
| GET /s/{code} | 302 with Location header | 404 unknown code |

Use a consistent JSON error structure, such as code and message. Display a friendly unknown-link page for browser users where practical. Choose one repeated-input policy and document it; generating a new mapping each time is sufficient for this scope.

### Data model

- id: internal primary key.
- code: short code with a database unique constraint and indexed lookup.
- originalUrl: saved destination.
- createdAt: creation timestamp.

### Responsibilities

- Controller: request and response handling.
- Service: URL validation, length rule, code generation, collision handling, and lookups.
- Repository: database access.
- DTOs: request and response shapes.
- Exception handler: consistent errors without internal stack traces.
- Configuration: public base URL, database settings, and allowed frontend origin when needed.

Start with a seven-character alphanumeric code. Enforce uniqueness in the database, retry collisions a bounded number of times, and fail cleanly if retries are exhausted. A pre-insert existence check alone cannot guarantee uniqueness under concurrent requests. Do not add distributed infrastructure for this assessment.

### Input decisions

- Reject empty or whitespace-only input.
- Trim surrounding spaces before comparison and storage.
- Require an explicit http:// or https:// scheme and a valid hostname.
- Reject control characters and URLs containing embedded username/password credentials.
- Define a maximum input length, for example 4096 characters, and enforce compatible API and database limits. This is an application policy, not a universal URL limit.
- Reject unsupported schemes such as javascript:, data:, and file:.
- If the complete output URL is equal in length or longer, explain that the input is already too short to shorten.
- Use one validation policy on the backend; frontend checks improve feedback but never replace it.

## 5 Frontend and mobile outline

One polished page is enough. Include a clear title, concise guidance, labelled URL input, example placeholder, Shorten button, loading feedback, inline errors, and a result card with a copy button and confirmation.

- Disable duplicate submissions while a request is pending.
- Preserve the user's input after errors and allow retry.
- Handle network failures and clipboard failures gracefully.
- Stack controls on narrow screens and keep tap targets comfortably sized.
- Wrap long URLs without causing horizontal scrolling.
- Support Enter submission, keyboard navigation, visible focus, readable contrast, and screen-reader announcements for results and errors.
- Test approximate widths of 360, 390, 768, and 1280 pixels, plus an actual phone if available.
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

> Context: I am building a URL shortener with Spring Boot and React. POST /api/urls accepts an originalUrl and returns a shortUrl. Only HTTP and HTTPS URLs with a hostname are accepted. The full generated URL must be shorter than the trimmed input. The public base URL is configurable.
>
> Task: Review the attached validation service for missing edge cases. Do not change unrelated files.
>
> Constraints: Do not fetch destination URLs, add dependencies, introduce authentication, or change destination query parameters. Explain any uncertainty.
>
> Acceptance criteria: Reject blank input, unsupported schemes, missing hostname, embedded credentials, control characters, and URLs above the configured length limit. Preserve valid query strings and fragments.
>
> Output: List findings with reasons, propose the smallest changes, and suggest tests.
>
> Verification: I will inspect the changes, run the tests, and check valid and invalid requests manually.

Keep a concise docs/ai-usage.md with a few useful prompts, what you accepted or rejected, how you checked the output, and what you learned. Do not put secrets, credentials, or private employer material into prompts. You should be able to explain every submitted change. Time budget: about 30 minutes initially, then brief notes during development.

## 7 Security implementation and scanning

### Build basic protections early

- Enforce backend validation and input limits from the start.
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

Example provisional normal-load goals: p95 under 500 ms for creation, p95 under 200 ms for redirect lookup, and under 1 percent unexpected errors. These are self-selected local goals, not promised results or production SLAs. Configure k6 success handling so expected 302 responses count as success. Keep deliberate validation errors and expected rate-limit 429 responses separate from unexpected failures.

Record the command, application commit, machine/runtime details, dataset size, warm-up, duration, virtual users, pacing, achieved throughput, endpoint latency, error rate, and limitations in docs/performance.md. Report actual measurements honestly. Repeat after a relevant fix, not endlessly. Local tests do not establish production capacity.

Time budget: about 60 to 90 minutes for a useful initial script and report; deeper stress testing is optional.

## 9 Test checklist

### Backend unit tests

- Valid HTTP and HTTPS input, including query strings and fragments.
- Empty, malformed, missing-host, unsupported-scheme, control-character, credential, and over-limit input.
- Whitespace trimming and strict full-output length comparison, including equal lengths.
- Successful code generation, collision retry, and bounded retry failure.
- Known-code lookup and unknown-code behaviour.

### Integration tests

- POST returns the agreed response and persists the mapping.
- GET returns the correct redirect status and exact Location.
- Invalid requests return consistent errors.
- Database uniqueness is enforced.
- Separate test database does not modify local development data.

### Frontend tests and manual checks

- Form submission, loading, success, validation, and server failure states.
- Copy success and failure feedback.
- Keyboard submission and accessible labels.
- Desktop and mobile layouts, long URL wrapping, and retry behaviour.
- Open a short link in a new tab and after an application restart.

Include required unit tests explicitly; load tests and security scans do not replace them.

## 10 Repository and delivery outline

Suggested folders: backend/, frontend/, docs/, and tests/load/. Keep one root README.md and .gitignore. Add a GitHub Actions workflow for backend tests and frontend tests/build once local commands work.

The README should cover the app, prerequisites, exact run and test commands, environment settings, persistence, API examples, architecture, validation decisions, desktop/mobile screenshots, known limitations, and links to AI usage, security, and performance notes. A clean checkout should run without private local files.

## 11 Initial timeline (Amanda: I will be doing as much as I can in one-two days instead)

| Date | Work and order | Completion checkpoint |
| --- | --- | --- |
| Sat 24 Oct | Confirm scope; create repository; write prompt template; implement API, database, validation, redirects, and unit tests; add basic security as code is written | Can create and follow a short URL; data survives restart |
| Sun 25 Oct | Build React interface and mobile styles; connect API; add frontend tests; establish CI; run initial dependency/source scans | Complete user journey works; scans started with time left to fix findings |
| Mon 26 Oct morning | Fix functional/security findings; finish accessibility and mobile checks; optionally run ZAP baseline | Stable candidate with required tests passing |
| Mon 26 Oct afternoon | Run k6 smoke and normal-load tests; add a bounded higher-load/recovery test if time allows; fix material issues and write reports | Repeatable test scripts and honest documented results |
| Tue 27 Oct morning | Test a clean clone; rerun relevant checks; finish README and AI learning notes; inspect GitHub contents and access | Submission ready by about 3pm Singapore time |
| Tue 27 Oct before 6pm | Send repository link using the requested email process; verify submission | Submitted before the deadline |

Protect a submission buffer. If behind, cut optional ZAP, elaborate monitoring, deep stress testing, and deployment first. Keep required functionality, unit tests, responsive UI, validation, and setup documentation. A small normal-load test and clear limitation note are better than unfinished infrastructure.

## 12 Final submission checklist

- [ ] Required user journey works, including real redirects.
- [ ] Every successful short URL is strictly shorter than its input.
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
