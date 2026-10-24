# Sniply — URL shortener assessment

Sniply is a Spring Boot and React URL shortener for a full stack engineering assessment.

## Current milestone

The Spring Boot backend and responsive React landing page are implemented, with frontend tests and GitHub Actions checks prepared. The create, copy, and redirect journey has been checked against a real local backend. Security scanning, performance testing, and final submission checks remain later milestones.

## Prerequisites

- Java 25 or later; verify with `java -version`.
- Internet access on the first run to download Maven and dependencies.
- Node.js 24 is recommended for the frontend and used in CI. The frontend also supports Node 20.19+ or Node 22.13+ within those major versions; verify with `node --version` and `npm --version`.

Maven is included through its wrapper; a separate Maven installation is unnecessary.

## Run the backend

From the extracted project root:

```bash
cd backend
./mvnw spring-boot:run
```

Windows PowerShell:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

The API runs at http://localhost:8080. The React landing page runs separately at http://localhost:5173; the backend root itself has no landing page.

## Run the frontend

Keep the backend running, then open a second terminal from the project root:

```powershell
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. Paste your destination, click **Snip my link** (or press Enter), then copy or open the result. Both terminals must remain running. Use Ctrl+C in each terminal to stop them.

If you enter `example.com` without a protocol, the textbox shows `https://example.com` as you type or paste a bare hostname (once it contains a dot), with blur/submit as a fallback. An explicit `http://` or `https://` is preserved. The 2,048-character limit includes the completed prefix; direct API callers must supply a full HTTP(S) URL.

The real editable URL field sits above the scissors. On submission, the character lifts the scissors and the field briefly splits around the submitted text; the generated link appears below as soon as the API responds. The field keeps its value and focus, and editing immediately restores its normal appearance. Reduced-motion preferences disable decorative animation. The result's **Original link** disclosure shows the saved destination, and **Clear URL** resets the form and result.

The field is labelled **Put your long URL here!** with a curly arrow. Confetti sits below the field. Mouse users get a native pixel-art scissors cursor with transparent handle centers; the URL field retains its text cursor, and touch devices keep normal behavior.

**Recent snips** keeps the latest 20 successful links in this browser: beside the tool on desktop (1,000px and wider), below it on smaller screens. Copy, remove, or clear entries; they survive normal reloads through localStorage. Clearing this list does not delete backend links. Different browsers/devices or frontend origins have separate histories. See [how recent snips work](docs/recent-snips.md).

Vite forwards `/api` and `/s/` requests to `http://127.0.0.1:8080`, so local development needs no broad CORS configuration. If your backend uses another port, set `BACKEND_PROXY_TARGET` before starting Vite, for example `$env:BACKEND_PROXY_TARGET = 'http://127.0.0.1:8081'` in PowerShell.

To inspect the frontend build locally:

```powershell
npm run build
npm run preview
```

The preview runs at http://localhost:4173 and uses the same API proxy. Vite preview is a local build check, not a production hosting service. A hosted application will need a reachable backend and appropriate routing; deployment is not part of this milestone.

### Check on a phone

With both devices on the same network, open `http://<computer-LAN-IP>:5173` on the phone. Before starting the backend, set `PUBLIC_BASE_URL` to that same reachable frontend origin so generated links use Vite's `/s/` proxy. Restart the backend after changing the value. The default `localhost` short links work only on the computer itself. Local firewall rules may need to allow the frontend port.

Clipboard access may be unavailable over a plain HTTP LAN address. The UI keeps the short URL selectable and provides manual-copy guidance when copying fails. Actual phone, zoom, and on-screen-keyboard checks are still manual review items.

### Create and follow a link

Git Bash, macOS, or Linux:

```bash
curl -i http://localhost:8080/api/urls \
  -H 'Content-Type: application/json' \
  -d '{"originalUrl":"https://www.visitsingapore.com/travel-guide-tips/travelling-to-singapore/"}'
```

Windows PowerShell:

```powershell
$body = @{ originalUrl = 'https://www.visitsingapore.com/travel-guide-tips/travelling-to-singapore/' } | ConvertTo-Json
$result = Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/api/urls' -ContentType 'application/json' -Body $body
$result
Start-Process $result.shortUrl
```

Creation returns HTTP 201 and a JSON object containing `originalUrl` and `shortUrl`. Open the returned URL to receive a 302 redirect. The code is generated, so do not hard-code an example code.

Links are saved to `backend/data/` when started from that directory. Restart from the same directory to reuse them. Local data files are excluded from Git. Removing this folder deletes your development links.

## Run tests

From `backend/`:

```bash
./mvnw test
```

Windows PowerShell:

```powershell
.\mvnw.cmd test
```

Service tests use mocks, API tests use an isolated in-memory H2 database, and migration tests use temporary file databases. They do not modify saved development links. The Mockito subclass mock maker is configured because these tests only mock interfaces and non-final classes; it avoids requiring runtime Java agent attachment.

Run `.\mvnw.cmd verify` on Windows (or `./mvnw verify` on macOS/Linux) for the complete backend check: 122 validator/unit/API/migration cases, executable JAR packaging, and one packaged-application restart test. The restart test starts and stops its own backend processes using a temporary H2 file and an available port. Migration tests also use temporary files; no development data is opened.

From `frontend/`:

```powershell
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

`npm test` runs the component and API-client tests once. `npm run test:watch` runs them interactively. Browser tests exercise the built frontend with a stubbed API at mobile and desktop widths; the backend is not needed for those checks.

For the optional real-backend browser checks, leave the backend running, build the frontend, and run `npm run test:live`. This creates a real mapping in the configured backend database. Prefer an isolated test database. Redirect following is disabled in the test, so it does not visit the destination website.

If you prefer an installed Chrome instead of downloading Chromium, set `$env:PLAYWRIGHT_CHANNEL = 'chrome'` before the browser commands. See [the test review guide](docs/testing.md) for what each suite proves, its limitations, and a suggested review order. Passing tests do not imply that Amanda has reviewed or approved them.

## GitHub Actions checks

The workflow is already defined in [.github/workflows/checks.yml](.github/workflows/checks.yml). Make **this folder (`stb-url-shortener/`) the GitHub repository root**, so `.github/`, `backend/`, and `frontend/` sit directly inside the repository.

After the source is pushed, the workflow runs on pushes and pull requests, and supports a manual run from the Actions tab:

- **Backend tests and build:** Java 25, Maven tests, packaging, and the packaged-application restart check (`verify`).
- **Frontend tests and build:** Node 24, locked dependency installation, component/API-client/URL-policy/history tests, build, and thirty-three Chromium browser checks, including recent-snips persistence/scroll containment, protocol completion, URL validation, and animation/reduced-motion behavior.

You do not need to recreate the workflow through GitHub's website. If Actions is disabled by repository or organisation policy, enable or request access there. Requiring the two checks before merging is a separate branch-rules setting you can configure on GitHub after the checks have run. No secrets or deployment credentials are needed for this workflow.

The workflow is prepared; confirm the latest revision's results in GitHub after pushing. No hosted result is claimed by this verification record. Optional live browser checks, security scanning, and load tests are not included in CI yet.

## Configuration

| Environment variable | Default | Purpose |
| --- | --- | --- |
| PORT | 8080 | Listening port |
| PUBLIC_BASE_URL | http://localhost:8080 | Origin included in generated links |
| DATABASE_URL | jdbc:h2:file:./data/shortener | Database connection |
| DATABASE_USERNAME | sa | Database username |
| DATABASE_PASSWORD | empty | Local development database password |

`PUBLIC_BASE_URL` must be an HTTP(S) origin, without a path, query, credentials, or fragment. It must point to a reachable backend route. When using a phone, localhost refers to the phone itself; configure the computer's reachable address and network access for later device testing. The generated URL is returned regardless of whether it is shorter than the input.

The empty database password is for a local demonstration. Configure credentials for any hosted environment. The H2 console is disabled. Do not expose this unfinished milestone publicly.

## API and rules

| Request | Expected behaviour |
| --- | --- |
| POST /api/urls with originalUrl | Save mapping; return 201 and Location header |
| GET /s/{code} (1–11 alphanumeric characters) | 302 redirect to original destination |
| Invalid destination or more than 2,048 characters | 400 with INVALID_URL |
| Malformed JSON | 400 with INVALID_REQUEST |
| Unknown short code | 404 with LINK_NOT_FOUND |

- New destinations must be HTTP(S) URLs with a recognized domain/TLD, valid percent escapes, no raw whitespace, and at most 2,048 characters. Accepted URLs are stored exactly as supplied; they are not trimmed or normalized. Localhost, IP-only destinations, credentials, and raw Unicode are rejected. See [the complete validation policy](docs/url-validation.md), including Punycode/encoded input support.
- Generated URLs are returned even when they are equal in length or longer than the input.
- Flyway V3 keeps the destination column as CLOB. The new 2,048-character creation limit is an application rule; existing saved links remain intact and are not revalidated during redirects.
- Destination path, case, query string, and fragment are preserved.
- The server never fetches destinations. Successfully saving a string does not guarantee that it can be used as a redirect destination.
- Repeated submissions create new mappings.
- New links use a positive database-sequence ID encoded as Base62 (`0–9`, `A–Z`, `a–z`). Codes are case-sensitive, unpadded, and 1–11 characters long. A fresh database starts with `1`; existing databases may start higher to preserve old links.
- Validation happens before ID allocation; invalid URLs consume no ID. Failures after allocation can leave gaps; allocated IDs are not recycled. Database failures are returned as server errors rather than retried as code collisions.
- The database retains both primary-key and code uniqueness constraints. Existing seven-character aliases keep their stored destinations, including aliases with leading zeros.

## Database upgrade and ID allocation

Flyway applies versioned H2 migrations at startup; Hibernate now validates the schema. Before the first upgraded launch against existing data, stop the old backend and make a backup copy of `backend/data/`. The assistant's verification uses isolated databases and does not migrate your development database.

H2 connections are initialized with `SET WRITE_DELAY 0` to remove its default delayed commit flushing, including with custom H2 URLs. This is a durability choice; its write-latency impact has not been measured.

V1 adopts the original table. V2 expands the code column to 11 characters, removes identity-column generation, and creates `short_link_id_seq` above both existing row IDs and decoded legacy codes. V3 widens the destination column to CLOB without changing IDs or saved values. These migrations preserve mappings and prevent the new numeric range from colliding with legacy aliases. Subsequent starts use migration history and do not restart the sequence. Restoring the older application version also requires a compatible database restore; the older identity-based application cannot use the upgraded schema unchanged.

The current implementation uses embedded H2. It does not establish multi-instance capacity, and sequential codes can be guessed. The ID-source interface can support a future shared database, but that requires a tested deployment and allocator implementation. See [backend-design.md](docs/backend-design.md) for the flow, tradeoffs, and corrections to the Copilot analysis.

## Code walkthrough

Read these files in order under `backend/src/main/java/com/amanda/urlshortener/`:

1. `link/ShortLinkController.java`: HTTP endpoints.
2. `link/ShortLinkService.java` and `link/UrlValidator.java`: validation before allocation, encoding, exact accepted-URL storage, and resolution.
3. `link/LinkIdAllocator.java`, `DatabaseLinkIdAllocator.java`, and `Base62Encoder.java`: ID-source boundary and compact encoding.
4. `link/ShortLink.java` and `ShortLinkRepository.java`: assigned IDs, database mapping, and lookup.
5. `web/ApiExceptionHandler.java`: client-facing errors.

Then read the five validator/unit/API/migration test classes and `ShortLinkRestartIT` under `src/test/java/`, followed by the migrations under `src/main/resources/db/migration/` and `src/main/java/db/migration/`. Validator tests share input fixtures with the frontend; service tests isolate database behavior; API tests exercise real H2 and Spring; migration tests verify file-backed legacy data; the packaged test verifies persistence after an immediate process stop.

## Next milestones

1. Review the frontend and backend tests and manually check the UI on an actual phone.
2. Push the latest changes to GitHub, confirm the prepared workflow passes there, and check reviewer access.
3. Security scans and practical hardening, including headers and request size limits.
4. Load testing with redirects disabled in the load client, plus response-time reporting.
5. Clean-checkout review and final submission documentation.

Local screenshots: [desktop landing page](docs/screenshots/landing-desktop.png), [desktop with recent snips](docs/screenshots/history-desktop.png), [input during the cut](docs/screenshots/input-cutting-desktop.png), [mobile result and history](docs/screenshots/result-mobile.png), and [mobile validation error](docs/screenshots/validation-mobile.png). Native cursors are not included in page screenshots.

## Documentation guide

| Document | Purpose |
| --- | --- |
| [Project plan](docs/project-plan.md) | Scope, current implementation, and remaining milestones |
| [Backend design](docs/backend-design.md) | Sequence/Base62 flow, persistence, migrations, and design tradeoffs |
| [URL validation](docs/url-validation.md) | Accepted formats, length limit, TLD snapshot, and availability policy |
| [Recent snips](docs/recent-snips.md) | Browser history, localStorage, layout, clearing, and persistence limits |
| [Testing guide](docs/testing.md) | Suite boundaries, commands, and manual review checklist |
| [Verification record](docs/verification.md) | Previously observed results, historical milestones, and unverified work |
| [Prompt template](docs/prompt-template.md) | Reusable context and constraints for new changes |
| [AI usage notes](docs/ai-usage.md) | AI workflow and Amanda's own work and learning notes |

## Current limitations

URL validation checks format and a bundled TLD snapshot; it does not prove domain registration, website availability, or safety. A strict-shortening guarantee is intentionally absent. No rate limiting, authentication, abuse detection, destination reputation checks, or total HTTP body size limit is implemented yet. Errors on unknown links currently return JSON rather than a browser-friendly page. Versioned migrations currently target H2; a production/shared database needs its own tested migrations and ID allocator. Security scans and load tests have not been run. Google Fonts are optional external styling requests; system fonts remain available if they cannot load. No public deployment or hosted CI result is claimed here.
