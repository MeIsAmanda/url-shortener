# Reusable change prompt

Replace the task and acceptance-criteria placeholders for each change. Give the assistant the relevant files and ask it to read [project-plan.md](project-plan.md), [backend-design.md](backend-design.md), and [testing.md](testing.md) before making changes. Use [verification.md](verification.md) for recorded results; do not treat planned work as verified.

## Role

Act as a senior full stack engineer helping me learn.

## Context

I am building Sniply, a URL shortener for a technical assessment.

- Backend: Java 25, Spring Boot, H2.
- Link IDs: Snowflake (41 timestamp / 10 worker / 12 counter bits) followed by Base62; fixed epoch 25 October 2026 00:00 Asia/Singapore. V5 preserves legacy aliases and persists worker timestamp reservations. Configure distinct SNOWFLAKE_WORKER_ID values for multiple instances. See [snowflake.md](snowflake.md).
- Frontend: React with Vite, JavaScript, and CSS; Node 24 recommended, with Node 20/24 CI checks. The page is responsive with a scissors submission animation and native pixel-art cursor.
- Recent snips: latest 20 successful links in localStorage, beside the tool on desktop and below it on smaller screens. History removal does not delete backend mappings. See [recent-snips.md](recent-snips.md).
- Accounts: optional Google OAuth2/OIDC sign-in, server sessions/CSRF, V4 account ownership, paginated My links with creation dates and atomic GET redirect counts. Guest history is separate; anonymous links are not auto-claimed. See [accounts.md](accounts.md).
- Destination policy: validate HTTP(S) format, recognized domain/TLD, percent escapes, no raw whitespace, and a 2,048-character maximum. Store accepted input unchanged; generated output need not be shorter. See [url-validation.md](url-validation.md).
- Form convenience: visibly add https:// to a missing protocol during bare-hostname keyboard entry/paste, with blur/submit as a fallback before validation. Preserve explicit schemes; direct API input still requires HTTP(S).

Describe the relevant existing code here.

## Task

One specific change I want to make.

## Constraints

- Follow the existing project structure.
- Read the relevant docs and code before proposing or generating changes.
- Avoid unnecessary dependencies or features.
- Never include credentials or sensitive information.
- Keep the fixed Snowflake epoch and persisted worker state compatible; ID-format changes need an explicit migration strategy. Snowflake codes are structured and roughly time-ordered.
- Preserve accepted destination strings and legacy aliases; keep the documented URL validation policy and visible frontend protocol completion. Do not otherwise trim/normalize input, fetch destinations, or require generated output to be shorter.
- Security scanning, performance testing, and deployment are separate milestones unless explicitly requested.
- Keep controls usable on mobile and respect reduced-motion preferences for decorative animations.
- Explain important decisions so I can understand the code.
- Keep documentation consistent, preserve my personal logs, and distinguish checks actually run from proposed checks.
- Keep README startup guidance concise; put configuration and detailed explanations in docs/. Link to [local development](local-development.md) and the dated verification record rather than duplicating test counts or claiming unperformed Google/device/security/performance checks.

## Acceptance criteria

Describe the observable behaviour that must work.
Include relevant edge cases and tests.

## Output

Explain the approach, identify the files to change,
and provide the implementation and verification steps.
Report which checks ran, their results, and anything still unverified.
