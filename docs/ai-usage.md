# AI usage and learning notes

The current implementation is Sniply: Java 25/Spring Boot, React, Snowflake IDs followed by Base62 encoding, and Flyway migrations. The fixed epoch is 25 October 2026 00:00 Asia/Singapore; V5 preserves legacy aliases and persists worker timestamp reservations. See [snowflake.md](snowflake.md). New destinations must pass the [URL validation policy](url-validation.md), including HTTP(S), domain/TLD, encoding, and a 2,048-character maximum. Accepted URLs are stored unchanged, without an output-length requirement. See [prompt-template.md](prompt-template.md) for reusable context.

## Prompt structure

Context → bounded task → constraints → acceptance criteria → expected output → independent verification.

Example prompt:

> Context: Sniply uses Java 25/Spring Boot and React; POST /api/urls creates a mapping and GET /s/{code} redirects. Task: Review destination validation and exact storage of accepted URLs. Constraints: Follow url-validation.md; do not fetch, trim, or normalize destinations; preserve existing aliases. Acceptance criteria: Reject invalid/over-limit input before allocation, preserve accepted encodings and query strings, retain unique Base62 codes, and propagate storage failures. Output: Explain findings and suggest targeted tests. Verification: I will inspect the changes and assertions, then run the relevant checks.

## Current decisions to review

- Snowflake combines elapsed milliseconds, worker identity, and a counter before insertion; allocation alone does not create a mapping. Timestamp reservations survive crashes; the previous database sequence is historical state.
- Base62 encodes that ID; the database still enforces primary-key and code uniqueness. Current codes have variable length, not a fixed seven characters.
- Allocator/insert failures propagate without a collision retry loop. Unused IDs and skipped reserved timestamps are expected and do not represent saved link rows.
- Generated links use configured PUBLIC_BASE_URL instead of the request Host header.
- New destinations are validated before allocation with a 2,048-character limit. Accepted strings are preserved, and generated links may be longer than the input. Validation does not prove website availability or safety.
- Flyway migrations preserve existing aliases; file-based H2 data must be backed up with the backend stopped.
- Test results are assistant-run evidence, not a substitute for Amanda's review. Security scans, load tests, and hosted CI confirmation remain separate work.

The personal logs below retain Amanda's wording. Technical clarification for the earlier research notes: uniqueness depends on coordinated allocation and preserved database state, not Base62 alone. The original random implementation handled insert conflicts through the database constraint and retries; it did not run a pre-insert existence query. See [backend-design.md](backend-design.md) for the architectural corrections.

## Amanda's Work log
- Provided requirements to GPT (Addition requirements/constraints like prompt framework, load/stress testing)
- generated backend codes
- did review on the backend codes and also research on different ways to code
- generated front end codes
- connected and uploaded to git
- review backend and frontend codes
- removed some unnecessary validation and change the id generation logic

## Amanda's time log
- Worked from 1pm-3pm: Finished generating all backend and frontend codes
- Worked from 8pm-10pm: Change up the code generation logic

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
- 