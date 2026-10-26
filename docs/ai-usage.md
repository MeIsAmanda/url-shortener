# AI usage and learning notes

## Current technical context — 27 October 2026

Sniply uses Java 25/Spring Boot, React/Vite, file-backed H2, and Flyway V1–V5 migrations. The implementation and recorded verification have evolved since the first milestone and the personal learning notes below.

- New link IDs use Snowflake with a fixed epoch of 25 October 2026 at midnight Singapore time, followed by Base62. IDs remain structured and roughly time-ordered. Distinct worker identities and preserved timestamp reservations support uniqueness; performance has not been benchmarked. See [snowflake.md](snowflake.md).
- ID allocation does not create an empty link row. The service saves the mapping afterward; failed inserts and unused reserved timestamps can leave gaps.
- New destinations must satisfy the HTTP(S), domain/TLD, encoding, and 2,048-character [validation policy](url-validation.md). Accepted input is stored unchanged. Generated URLs may be equal in length or longer than the destination.
- Guest recent history uses browser localStorage. Optional Google sign-in provides separate server-owned history and redirect counts; it does not claim older anonymous links. See [accounts.md](accounts.md).
- Automated checks and the passing hosted CI run are recorded in [verification.md](verification.md). Amanda reported completing the manual review checklist on 27 October 2026, including assertion review, actual-phone checks, and the wider Google account review. Fresh-machine startup, screen-reader review, security scans, and load testing remain separate work.

The personal work, time, and learning logs below retain Amanda's wording and can describe earlier assumptions. The current architecture and limitations above clarify those historical notes without rewriting them.

## Prompt structure

Context → bounded task → constraints → acceptance criteria → expected output → independent verification.

Example prompt:

> Context: Spring Boot URL shortener; POST /api/urls creates a mapping and GET /s/{code} redirects. Task: Review the URL validator for missing cases. Constraints: Do not fetch destinations or alter query strings. Acceptance criteria: Reject unsupported schemes, missing hostnames, credentials, controls, and over-limit input. Preserve valid destinations. Output: Explain findings and suggest targeted tests. Verification: I will inspect changes and run the tests.

## First milestone decisions to review (historical)

These notes describe the initial random-code design. The earlier output-length requirement was removed, and production allocation now uses Snowflake. Refer to the current context above when changing the application.

- Database uniqueness is essential even when random codes make collisions unlikely.
- Each insert needs its own transaction so a failed collision does not poison a retry.
- Generated links use configured PUBLIC_BASE_URL instead of the request Host header.
- The complete generated link must be shorter, including hostname and port.
- URL validation does not prove that a destination exists or is safe.

## Amanda's work log

- Defined the project requirements and constraints, including the responsive interface, URL-validation policy, AI prompting workflow, and planned security and performance checks.
- Used AI assistance to generate the initial Spring Boot backend and React frontend, then directed changes to the API, interface, and application behavior.
- Researched random codes, hashing, database-sequence IDs, and Base62 encoding, and compared their uniqueness and collision-handling requirements.
- Directed the change from random short codes to database-allocated IDs encoded with Base62, and later explored Snowflake allocation as a learning exercise in ID generation across workers.
- Reviewed backend and frontend code with AI assistance and refined validation and short-code generation decisions as the project developed.
- Directed updates to the scissors animation and interface, and added optional Google sign-in, account history, and click counts with AI assistance.
- Connected the project to GitHub and reviewed automated-check failures and proposed fixes, including the difference in invalid-Punycode handling between Node versions.
- Reorganized the README and supporting documentation to make setup, design tradeoffs, verification evidence, and remaining limitations easier for an examiner to find.

## Amanda's time log

These are approximate session notes, rather than a complete record of active development time. Sessions included waiting for AI-generated output and automated checks.

- **Saturday, 1–3pm:** Generated the initial backend and frontend with AI assistance.
- **Saturday, 8–10pm:** Revised short-code generation to use database-allocated IDs and Base62.
- **Saturday, 11pm–midnight:** Updated animations and visuals.
- **Sunday, around 2am:** Added functionality and refined validation.
- **Sunday, around 3am:** Added Snowflake allocation. My initial description was that it would “scramble” IDs; the learning notes below correct that understanding.
- **Monday, around 11pm:** Reviewed test cases, fixes, code, and documentation with AI assistance.

## Amanda's personal learning log

### Encoding and uniqueness are separate concerns

I initially focused on Base62 as the mechanism for generating short codes. I learned that it encodes a number compactly; it does not allocate that number or provide uniqueness by itself. Different allocated IDs produce different Base62 representations, while correct allocation and database constraints protect the saved mappings.

Seven Base62 characters have 62⁷ possible combinations, or about 3.5 trillion. That describes a code space, not the application's measured capacity. The current Snowflake-based codes are variable length and grow with elapsed time.

### Random codes, hashes, and allocated IDs have different tradeoffs

Random or truncated hash-based codes can collide, so the application needs database-enforced uniqueness and an appropriate conflict-handling strategy. A coordinated database sequence provides distinct IDs without a separate application-level check for an existing code. The database still checks its constraints during insertion.

My earlier description of the original implementation as “generate, then check whether it exists” was imprecise: it used database uniqueness and conflict retries. Changing the allocator was a design choice, not proof that the previous approach could not scale.

### Snowflake changes allocation; it does not scramble IDs

I chose Snowflake to explore ID allocation across multiple application instances and potentially separate databases without a shared per-ID counter. This requires globally coordinated worker identities and safe clock and restart handling. My implementation generates IDs in memory within timestamp windows reserved in the database, reducing allocation round trips while retaining a database dependency for reservation renewal. Future work would include multi-database routing, orchestration to coordinate worker identities, and performance testing to evaluate the design under load.

### A URL shortener still needs a stored mapping

The application saves each public alias with its destination and looks up the exact alias during redirects. Allocating an ID does not create the mapping. Failed saves can leave unused IDs, and preserving old aliases matters when changing the allocation strategy.

### Validation needs explicit rules and consistent behavior

Syntax validation does not prove that a domain exists or that a destination is safe. Accepted paths, query strings, and fragments should be preserved. The invalid-Punycode test failure also showed why relying only on a runtime's URL parser can produce different frontend behavior across Node versions. Explicit validation and shared fixtures make that policy clearer.

### Verification has boundaries

Unit tests, database integration tests, browser tests with stubbed APIs, and real-backend checks establish different things. Mocked Google identities do not prove a real Google login works, and desktop viewport tests do not replace an actual phone check. I learned to distinguish implemented behavior, recorded automated results, and outstanding manual checks when describing the project.

### Scope and handover matter

The project expanded beyond basic shortening into animations, accounts, analytics, and a different ID allocator. Each addition creates more behavior to explain and verify. Clear setup instructions, accurate documentation, and a reliable core flow are important parts of the submission alongside the code.
