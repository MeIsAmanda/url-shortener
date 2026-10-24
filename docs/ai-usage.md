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