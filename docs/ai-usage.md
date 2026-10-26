# AI usage and learning notes

## Current technical context — 27 October 2026

Sniply uses Java 25/Spring Boot, React/Vite, file-backed H2, and Flyway V1–V5 migrations. The implementation and recorded verification have evolved since the first milestone and the personal learning notes below.

- New link IDs use Snowflake with a fixed epoch of 25 October 2026 at midnight Singapore time, followed by Base62. IDs remain structured and roughly time-ordered. Distinct worker identities and preserved timestamp reservations support uniqueness; performance has not been benchmarked. See [snowflake.md](snowflake.md).
- ID allocation does not create an empty link row. The service saves the mapping afterward; failed inserts and unused reserved timestamps can leave gaps.
- New destinations must satisfy the HTTP(S), domain/TLD, encoding, and 2,048-character [validation policy](url-validation.md). Accepted input is stored unchanged. Generated URLs may be equal in length or longer than the destination.
- Guest recent history uses browser localStorage. Optional Google sign-in provides separate server-owned history and redirect counts; it does not claim older anonymous links. See [accounts.md](accounts.md).
- Automated checks and the passing hosted CI run are recorded in [verification.md](verification.md). Guided review is in progress; no full manual approval, real Google login, device verification, security scan, or load-test result is implied.

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

## Amanda's Work log
- Defined the project requirements and constraints for the AI-assisted workflow, including prompt structure, validation rules, and load/stress testing considerations.
- Researched different URL-shortening approaches and compared trade-offs between random code generation, hash-based generation, and a database-backed ID + Base62 encoding strategy.
- Reviewed the backend implementation, identified weaknesses in validation and short-code generation, and refined the design to improve reliability.
- Generated the backend code for URL creation, storage, lookup, and redirect behavior.
- Generated the frontend interface and connected the client to the API.
- Reviewed both backend and frontend code for consistency, correctness, and maintainability before finalizing the implementation.
-Removed unnecessary validation logic and replaced the earlier random short-code approach with a more scalable unique ID-based generation model.
- Validated the implementation through testing and iterative fixes, and documented the final architecture and decisions.

## Amanda's time log
- Sat 1pm-3pm: Finished generating all backend and frontend codes
- Sat 8pm-10pm: Change up the code generation logic
- To note that most of the time is spent waiting for CODEX to finish generating its answers and rerunning its checks.
- Sat 11pm-12am: Finished updating animations and visuals
- Sun 2am: added new feature. polished validation. 
- Sun 3am: added snowflake id generation to scramble the id sequence
- Mon 11pm: fix and review test cases. make final review of codes and docs

## Amanda's Personal learning log

After reviewing and running the code, record what you learned, any suggestions you rejected, changes you made, and the checks you performed. Do not fill this section with claims before doing the work.

- Researched on bit.ly's style of shortening url codes -> Database mapping, lookup and logging
- Hash-based codes are possible, but need collision handling and a stored destination mapping. 
- Read up on Base62 and how it shortens the links dramatically.

Why Base62 Wins
• Massive Scale: A 7-character Base62 string allows for 62⁷ or roughly 3.5 trillion unique permutations.
• Zero Collisions: Because every link gets a brand new number from the counter, two different URLs will never get the same short code.
• High Efficiency: The database never has to run a slow check to see if a short code already exists before creating a new one—it just saves the pair and moves on.

- Previously the logic is generate random code and then check if it is unique, change to get a pre-allocated id sequence from db
- Change to getting an id from the db instead.
- Realized that the codes were sequential
- Decided to use twitter snowflake id generation to scramble the generated url