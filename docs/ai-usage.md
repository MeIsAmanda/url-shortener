## Prompt structure

Context → bounded task → constraints → acceptance criteria → expected output → independent verification.

Example prompt:

> Context: Spring Boot URL shortener; POST /api/urls creates a mapping and GET /s/{code} redirects. Task: Review the URL validator for missing cases. Constraints: Do not fetch destinations or alter query strings. Acceptance criteria: Reject unsupported schemes, missing hostnames, credentials, controls, and over-limit input. Preserve valid destinations. Output: Explain findings and suggest targeted tests. Verification: I will inspect changes and run the tests.

## First milestone decisions to review

- Database uniqueness is essential even when random codes make collisions unlikely.
- Each insert needs its own transaction so a failed collision does not poison a retry.
- Generated links use configured PUBLIC_BASE_URL instead of the request Host header.
- The complete generated link must be shorter, including hostname and port.
- URL validation does not prove that a destination exists or is safe.

## Amanda's Personal learning log

After reviewing and running the code, record what you learned, any suggestions you rejected, changes you made, and the checks you performed. Do not fill this section with claims before doing the work.

- Researched on bit.ly's style of shortening url codes -> Database mapping, lookup and logging
- Researched if hashing is possible -> Nope. There will be collision. Have to be database mapping. If that is the case, this url shortener does not feel complete without having deployed the DBs and have a system of distributed coordingation system (eg. Apache Zookeeper)
- Read up on Base62 and how it shortens the links dramatically.

Why Base62 Wins
• Massive Scale: A 7-character Base62 string allows for 62⁷ or roughly 3.5 trillion unique permutations.
• Zero Collisions: Because every link gets a brand new number from the counter, two different URLs will never get the same short code.
• High Efficiency: The database never has to run a slow check to see if a short code already exists before creating a new one—it just saves the pair and moves on.

- Read up on Base62 and how it shortens the links dramatically.

## Assistant implementation record — frontend milestone, 24 October 2026

Request: implement the React landing page, frontend tests, and repository-based GitHub Actions checks; defer security and performance checks. Keep the current backend contract and code-generation policy.

The assistant read the four docs files and current backend API, implemented React/Vite with CSS and a local API proxy, added Vitest/React Testing Library and Playwright tests, and prepared `.github/workflows/checks.yml`. Google Fonts are optional styling requests; the application itself calls the local backend. No account system, distributed infrastructure, public deployment, or external repository was created.

Assistant verification: 28 frontend component/API-client tests, 6 isolated browser tests, 2 real-backend browser checks, the frontend build, and backend `verify` passed. The live run used an isolated in-memory database and did not follow redirects to external destinations. Screenshots were inspected. Hosted CI, security scans, and performance checks have not run.

Amanda's review of the test implementation and UI remains pending. `docs/testing.md` explains the test boundaries and how to review them. This implementation record does not describe personal learning or approval on Amanda's behalf.
