# URL shortener assessment

A Spring Boot and React URL shortener for a full stack engineering assessment.

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

Open http://localhost:5173. Paste a long HTTP(S) URL, click **Shorten my link** (or press Enter), then copy or open the result. Both terminals must remain running. Use Ctrl+C in each terminal to stop them.

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

Tests use a separate in-memory database and do not modify saved development links. The Mockito subclass mock maker is configured because these tests only mock interfaces and non-final classes; it avoids requiring runtime Java agent attachment.

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

- **Backend tests and build:** Java 25, Maven tests, and packaging (`verify`).
- **Frontend tests and build:** Node 24, locked dependency installation, component/API-client tests, build, and six Chromium browser checks.

You do not need to recreate the workflow through GitHub's website. If Actions is disabled by repository or organisation policy, enable or request access there. Requiring the two checks before merging is a separate branch-rules setting you can configure on GitHub after the checks have run. No secrets or deployment credentials are needed for this workflow.

The workflow has been prepared locally; no repository was created or pushed, and no hosted GitHub run is claimed. Optional live browser checks, security scanning, and load tests are not included in CI yet.

## Configuration

| Environment variable | Default | Purpose |
| --- | --- | --- |
| PORT | 8080 | Listening port |
| PUBLIC_BASE_URL | http://localhost:8080 | Origin included in generated links |
| DATABASE_URL | jdbc:h2:file:./data/shortener | Database connection |
| DATABASE_USERNAME | sa | Database username |
| DATABASE_PASSWORD | empty | Local development database password |

`PUBLIC_BASE_URL` must be an HTTP(S) origin, without a path, query, credentials, or fragment. It must point to a reachable backend route. When using a phone, localhost refers to the phone itself; configure the computer's reachable address and network access for later device testing. Increasing the base URL length can prevent some inputs from being shortened.

The empty database password is for a local demonstration. Configure credentials for any hosted environment. The H2 console is disabled. Do not expose this unfinished milestone publicly.

## API and rules

| Request | Expected behaviour |
| --- | --- |
| POST /api/urls with originalUrl | Save mapping; return 201 and Location header |
| GET /s/{seven-character code} | 302 redirect to original destination |
| Invalid or already-short URL | 400 with error code and message |
| Unknown short code | 404 with LINK_NOT_FOUND |

- Only correctly formed HTTP(S) URLs with a hostname are accepted.
- Surrounding spaces are trimmed; control characters and embedded credentials are rejected.
- Input limit is 4096 characters. International domain names should use their ASCII/punycode form.
- The entire generated URL must be strictly shorter than the trimmed destination.
- Destination path, case, query string, and fragment are preserved.
- The server never fetches destinations. Syntax validation does not establish that a destination is reachable or safe.
- Repeated submissions create new mappings.
- Codes are random alphanumeric strings with a database uniqueness constraint and at most five attempts to resolve collisions.
- The service intentionally has no outer transaction around the collision loop; each failed insert rolls back before retry.

## Code walkthrough

Read these files in order under `backend/src/main/java/com/amanda/urlshortener/`:

1. `link/ShortLinkController.java`: HTTP endpoints.
2. `link/ShortLinkService.java`: length comparison, persistence, collision retries, and resolution.
3. `link/UrlValidator.java`: validation without network requests.
4. `link/ShortLink.java` and `ShortLinkRepository.java`: database mapping and lookup.
5. `web/ApiExceptionHandler.java`: client-facing errors.

Then read the three test classes under `src/test/java/`. The service unit tests isolate database behaviour with mocks; the API tests run with a real H2 database and the Spring web application context.

## Next milestones

1. Review the frontend and backend tests and manually check the UI on an actual phone.
2. Push the project to GitHub, confirm the prepared workflow passes there, and check reviewer access.
3. Security scans and practical hardening, including headers and request size limits.
4. Load testing with redirects disabled in the load client, plus response-time reporting.
5. Clean-checkout review and final submission documentation.

See [verification results](docs/verification.md), [the project plan](docs/project-plan.md), and [AI usage notes](docs/ai-usage.md). Local screenshots: [desktop landing page](docs/screenshots/landing-desktop.png) and [mobile result](docs/screenshots/result-mobile.png).

## Current limitations

No rate limiting, authentication, abuse detection, destination reputation checks, or production database migrations yet. The application input limit does not yet impose a total HTTP body size limit. Errors on unknown links currently return JSON rather than a browser-friendly page. H2 schema updates simplify this milestone; production should use controlled migrations and a suitable database. Security scans and load tests have not been run. Google Fonts are optional external styling requests; system fonts remain available if they cannot load. No public deployment or hosted CI run is claimed.
