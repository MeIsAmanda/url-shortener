# Local development and API reference

Start with the [README quick start](../README.md#quick-start) for the default guest demo. This guide covers optional configuration and direct API use. Start the backend from `backend/` so the default relative database path stays consistent.

## Environment settings

Set backend values in the shell or IDE run configuration **before** starting the backend. A plain `.env` file is not automatically loaded by this Spring Boot setup. Keep credentials out of Git and frontend code.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | Backend listening port |
| `PUBLIC_BASE_URL` | `http://localhost:8080` | Origin included in generated short links |
| `DATABASE_URL` | `jdbc:h2:file:./data/shortener` | Embedded H2 database location |
| `DATABASE_USERNAME` | `sa` | Database username |
| `DATABASE_PASSWORD` | empty | Local demonstration database password |
| `SNOWFLAKE_WORKER_ID` | `0` | Generator identity, 0–1023; distinct for independent instances |
| `FRONTEND_BASE_URL` | `http://localhost:5173` | Trusted post-login origin and Google callback origin |
| `GOOGLE_LOGIN_ENABLED` | `false` | Enable Google login after OAuth configuration |
| `GOOGLE_CLIENT_ID` | empty | Backend-only Google Web OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | empty | Backend-only Google client secret |
| `SESSION_COOKIE_SECURE` | `false` | Set `true` for HTTPS hosting; local defaults support HTTP |

`PUBLIC_BASE_URL` must be an HTTP(S) origin with no path, query, credentials, or fragment, and must route to the backend's `/s/` endpoint. It does not change the API's listening address. Localhost links work only on the computer creating them. The generated URL is returned even if its full length exceeds the destination's length.

The frontend's `BACKEND_PROXY_TARGET` defaults to `http://127.0.0.1:8080`. Set it in the **frontend terminal** if the backend uses a different port. Vite proxies `/api`, `/s/`, `/oauth2`, and `/login/oauth2`; the default local setup needs no broad CORS policy. For example, in PowerShell before `npm run dev`:

```powershell
$env:BACKEND_PROXY_TARGET = 'http://127.0.0.1:8081'
```

For macOS/Linux or Git Bash, use `export BACKEND_PROXY_TARGET='http://127.0.0.1:8081'` in that terminal. The README invokes the Unix Maven wrapper through `bash ./mvnw`, so startup and checks work without changing its executable bit.

For Google client setup and exact callback URLs, use [accounts.md](accounts.md). Hosted use needs HTTPS, secure cookies, appropriate credentials, and separately reviewed deployment configuration. The H2 console is disabled.

## Direct API example

With the backend running, from another terminal:

```bash
curl -i http://localhost:8080/api/urls \
  -H 'Content-Type: application/json' \
  -d '{"originalUrl":"https://en.wikipedia.org/wiki/URL_shortening"}'
```

PowerShell alternative:

```powershell
$body = @{ originalUrl = 'https://en.wikipedia.org/wiki/URL_shortening' } | ConvertTo-Json
$result = Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/api/urls' -ContentType 'application/json' -Body $body
$result
Start-Process $result.shortUrl
```

Creation returns HTTP 201, a `Location` header, and JSON containing `originalUrl` and `shortUrl`. The code is generated; use the returned URL rather than hard-coding one. Direct API input requires an explicit HTTP(S) scheme; only the web form completes an omitted protocol.

| Request | Behavior |
| --- | --- |
| `POST /api/urls` with `originalUrl` | Validate, save a new mapping, and return 201; signed-in creation requires CSRF protection |
| `GET /s/{code}` | Return 302 to the saved destination and increment its counter |
| `HEAD /s/{code}` | Return redirect headers without incrementing the counter |
| Invalid destination / malformed JSON | 400 with `INVALID_URL` / `INVALID_REQUEST` |
| Unknown code | 404 with `LINK_NOT_FOUND` |
| `GET /api/auth/session` | User or null, sign-in availability, and CSRF token; no-store |
| `GET /api/account/links` | Owner-scoped cursor history, dates, and counts; 401 when unauthenticated |
| `POST /api/auth/logout` | CSRF-protected session logout; 204 |

Accepted destinations are stored unchanged, including path case, query strings, and fragments. Repeated submissions create distinct mappings. Availability is not checked. See [url-validation.md](url-validation.md) for complete creation rules and [accounts.md](accounts.md) for authenticated requests.

## Persistence and upgrades

The default file is `backend/data/shortener.mv.db` when started from `backend/`. Use the same working directory and database URL after a restart. A `jdbc:h2:mem:...` URL instead uses temporary memory storage. Database files and downloaded local toolchains are excluded from Git; source control is not a data backup.

Before upgrading an existing database, stop the backend and copy the complete `backend/data/` directory elsewhere. Preserve mappings, Flyway history, and Snowflake settings/reservations together. Flyway applies pending migrations automatically and Hibernate validates the resulting schema. Do not run the older allocator against an upgraded database. See [backend-design.md](backend-design.md#existing-database-compatibility) and [snowflake.md](snowflake.md#existing-databases-and-backup) for the migration history and restore constraints.

## Preview a production build

From `frontend/`, with the backend running:

```bash
npm run build
npm run preview
```

Open http://localhost:4173. The preview uses the same API proxy. It is a local build preview, not a production hosting service. Use [testing.md](testing.md#optional-live-check) for an isolated real-backend browser check that does not add links to development data.

## Guest demonstration on a phone

On the same network, open `http://<computer-LAN-IP>:5173` on the phone. Before starting the backend, set `PUBLIC_BASE_URL` to that same reachable frontend origin so short links use Vite's `/s/` proxy. Restart the backend after changing it. The frontend binds to all interfaces; local firewall rules may still need to allow port 5173.

Clipboard access can be unavailable over plain HTTP on a LAN address. The UI keeps the link selectable and provides manual-copy guidance. Actual phone, mobile Safari, browser zoom, and on-screen-keyboard checks remain manual assessment items; desktop browser viewport tests do not establish device verification.
