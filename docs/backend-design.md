# Snowflake IDs and Base62 codes

As of 25 October 2026, new links use Snowflake IDs with a fixed epoch of 25 October 2026 00:00 Asia/Singapore, followed by the existing Base62 encoder. This supersedes the database sequence allocator introduced on 24 October. The API and frontend contract remain `POST /api/urls` with `originalUrl` and `GET /s/{code}` for redirects. See [snowflake.md](snowflake.md) for the format, durable timestamp reservations, worker configuration, and failure behavior.

## Current destination policy

As of 25 October 2026, new destinations require HTTP(S), valid domain labels and a recognized IANA TLD, correctly encoded URL characters, and a maximum of 2,048 characters. Validation runs before ID allocation. Accepted values are stored unchanged; no trimming, normalization, DNS lookup, or website-existence check occurs. The service can still generate output longer than the input. See [url-validation.md](url-validation.md) for the full policy and limitations. This supersedes the earlier accept-any-string policy.

The web form visibly completes a missing protocol as https:// during bare-hostname keyboard entry/paste, with blur/submit as a fallback before calling the API. The backend remains strict: it validates the complete URL supplied by its caller and stores it unchanged. The prefix counts toward the maximum length.

## Creation flow

```text
Controller
  → UrlValidator.validate(originalUrl)
  → LinkIdAllocator.nextId()
  → Base62Encoder.encode(id)
  → construct complete public URL
  → insert ShortLink(id, code, originalUrl)
  → return 201 after the repository transaction succeeds
```

The allocated ID is the new row's primary key. No random generator, existence query, or collision retry is needed in the normal creation path. The primary key and code unique constraint still reject integrity violations; the service does not hide them or claim success before persistence.

Allocation produces a number, not an empty row. `SnowflakeLinkIdAllocator` combines elapsed milliseconds, worker identity, and a per-millisecond counter. `SnowflakeTimestampStore` durably reserves up to one second of timestamps per worker when needed; generation within a window uses memory. `saveAndFlush` inserts the mapping afterward. A failed insert can leave an unused ID without leaving a saved mapping. It may still incur database/log work; gaps do not mean that blank link rows accumulate.

The encoder still uses the fixed alphabet `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`. These examples explain numeric encoding; fresh Snowflake databases do not issue small sequential IDs starting at 1:

| ID | Code |
| ---: | --- |
| 1 | `1` |
| 10 | `A` |
| 35 | `Z` |
| 36 | `a` |
| 61 | `z` |
| 62 | `10` |
| 1,000,000 | `4C92` |

Codes grow as numbers grow, up to 11 characters for a positive Java long. There is no fixed seven-character promise. With Snowflake, code length grows with elapsed time; the classic layout needs nine Base62 characters after one day. IDs increase within a worker, but concurrent workers/requests can finish in a different order. Base62 text also does not sort in numeric order across digit-length boundaries.

## Responsibilities

- `LinkIdAllocator`: interface separating the service from the ID source.
- `SnowflakeLinkIdAllocator`: fixed epoch, 41/10/12-bit assembly, per-process synchronized counter, clock/lifetime checks, and bounded rollover/restart waiting.
- `SnowflakeTimestampStore`: independently committed, row-locked timestamp windows in H2, persisted epoch checks, and the legacy ID floor. This avoids reissuing timestamps after a process crash. The old `DatabaseLinkIdAllocator` exists only as a sequence-migration test helper.
- `Base62Encoder`: converts an integer to a compact string without truncation, hashing, randomness, or database access.
- `UrlValidator`: creation-time format, length, and bundled-TLD checks without contacting the destination.
- `ShortLinkService`: validation, allocation, encoding, verbatim persistence of accepted values, and lookup.
- `ShortLink`: assigned primary key, unique code, original destination, and timestamp. `Persistable.isNew()` tells Spring Data to insert a newly constructed entity even though its ID is already present. Lifecycle callbacks mark persisted/loaded objects as existing.
- `ShortLinkRepository`: save and exact-code lookup.
- Flyway migrations: initialize/upgrade H2 once; Hibernate uses `ddl-auto=validate`.

The ID-source interface is an in-process boundary. It does not introduce another network service or prove horizontal scalability. Embedded H2 remains a single-instance local choice.

## Google accounts and redirect counts

Google OAuth2/OIDC sign-in now creates or restores a local account by verified Google subject. Signed-in creation gets its owner ID from the backend principal, with CSRF protection; anonymous creation remains public and unowned. V4 adds the accounts table, nullable owner column, zero-initialized click counter, and owner/history index. A private cursor-paginated endpoint filters by the authenticated owner and returns server creation dates and counts. Old anonymous/browser links are not automatically assigned.

GET redirect resolution performs an atomic `click_count = click_count + 1` update before returning a no-store 302. HEAD and unknown codes do not increment counts. These totals include repeat visits and bots; they are not unique-human analytics. The extra database write has not been benchmarked. See [accounts.md](accounts.md) for OAuth setup, session behavior, counters, and testing limits.

## Persistence, gaps, and failures

H2 is the embedded relational database used by this project. The default `jdbc:h2:file:./data/shortener` stores data in `backend/data/shortener.mv.db` when the backend is launched from `backend/`. Restarting from the same directory with the same database URL preserves mappings, schema history, and sequence state. A `jdbc:h2:mem:...` URL instead uses temporary in-memory storage, as in API/live-browser tests.

For a local backup, stop the backend and copy the whole `backend/data/` directory to a separate location. Restore that stopped database together with a compatible application version; do not combine mappings from one backup with allocator state from another. These local data files are ignored by Git, so committing the source does not back up saved links. A custom `DATABASE_URL` may store data elsewhere.

Snowflake reservations commit independently of link insertion. Failed inserts leave gaps, and restarts skip unused portions of the previous window. Clock rollback and exhausted timestamps fail rather than reuse IDs. The previous V2 H2 sequence also preserved gaps after rollback; it remains historical database state and is no longer used for new links. [H2 sequence expression semantics](https://www.h2database.com/html/grammar.html#sequence_value_expression).

Do not reset the epoch or worker reservations, manually reuse IDs, or copy independent databases into a common code namespace without a migration strategy. Preserve allocator state together with mappings through backup, restore, and failover. Every independent generator needs a distinct worker identity. Local H2 reservation locking is not a cross-database worker registry.

The application configures Hikari's connection initialization SQL to `SET WRITE_DELAY 0`. H2's default is a 500 ms delay between committing and flushing the log; an abrupt stop immediately after a successful response exposed that window during verification. The explicit setting also applies when a custom H2 `DATABASE_URL` is supplied. It removes the configured delay, with a potential write-latency cost that has not been benchmarked. Hardware/power-loss durability is outside these checks. This setting is H2-specific and must be revisited with a different database. [H2 write-delay setting](https://www.h2database.com/html/commands.html#set_write_delay).

Spring Data's normal new-entity detection treats non-null IDs as existing without a version field. The `Persistable` lifecycle pattern prevents a duplicate assigned ID from silently entering an update/merge path. [Spring Data entity persistence](https://docs.spring.io/spring-data/jpa/reference/jpa/entity-persistence.html).

## Existing database compatibility

V1–V5 are ordered revisions applied to the same database, not separate servers. V3 widens the destination column; V4 adds accounts/counters. V5 preserves every mapping and records the fixed Snowflake epoch, safe legacy ID floor, and worker reservations. It scans row IDs and numeric alias values and includes the old sequence's consumed range, then new timestamp allocation begins above that floor. It retains the unused old sequence. An occupied future range blocks creation until safe time is available; exhausted ranges fail migration. See [Snowflake upgrade details](snowflake.md#existing-databases-and-backup).

The following describes the historical V2 sequence upgrade, which is still applied before V5:

The old backend used independent identity primary keys and random seven-character public codes. Simply restarting a new sequence at 1 would eventually risk colliding with an old public alias or existing row ID.

The migration therefore does the following:

1. Adopt the original schema using Flyway baseline version 0 and V1's `CREATE TABLE IF NOT EXISTS`.
2. Scan the old IDs and seven-character codes once, decoding codes with the historical alphabet only to find a safe allocation floor.
3. Widen the code column to 11 characters and remove identity-column allocation.
4. Create a non-cycling sequence above the greater of the largest primary key and the largest decoded legacy code.
5. Leave existing rows, destinations, timestamps, and public aliases unchanged.

For example, legacy `zzzzzzz` occupies numeric value 3,521,614,606,207. The first new ID must then be at least 3,521,614,606,208, encoded `10000000`. A fresh empty database starts at 1. This reservation deliberately skips unused numbers to avoid a per-request legacy collision check.

Redirects always query the exact stored alias. They do not decode the incoming code to find an ID: `0000001` and `1` are distinct strings, and old aliases need not equal the encoding of their old primary keys.

Flyway serializes migrations and records history. Migrations should not be edited after application; introduce another version instead. The migration only supports the original seven-character schema. Stop the old application and back up its file database before the first upgraded launch. H2 DDL can commit independently, so a database backup is the rollback path. Do not run the old identity-based application against the upgraded schema.

Spring Boot's Flyway starter provides startup integration. [Spring Boot database initialization](https://docs.spring.io/spring-boot/how-to/data-initialization.html).

## Corrections to the Copilot analysis

| Claim | Assessment |
| --- | --- |
| A unique integer followed by Base62 is a useful design | Yes. It separates coordination from representation. |
| The previous implementation just hoped random strings would not collide | Incorrect. Its database constraint enforced uniqueness and it retried conflicts. |
| The previous implementation lacked a real service boundary | Incorrect. `ShortLinkService` already coordinated business rules; this revision makes the ID source a separate dependency. |
| Base62 guarantees uniqueness | Only when distinct integers are encoded without truncation and allocator state is preserved. Encoding does not allocate IDs. |
| Counter IDs are always more scalable than random IDs | Not established. V2 added a per-ID sequence query; current Snowflake uses memory inside durable time windows but still requires reservation transactions. Coordination, storage writes, and redirect traffic still matter. |
| All proposed ID sources offer equivalent guarantees | No. Durability, failover, worker identity, clock behavior, and coordination differ. Snowflake adds explicit worker/clock requirements; persistence still uses H2. |
| This describes Bitly's exact implementation | Not verified. Bitly's public API describes the interface, not sufficient internal allocator details to make that claim. [Bitly API](https://dev.bitly.com/api-reference/) |

The earlier notes about database checks also need precision: a sequence removes the need to check a candidate before insertion, but the database still enforces the unique indexes. The old implementation already avoided a pre-insert existence query.

Sequential public codes are predictable and enumerable; they do not provide authorization or confidentiality. Private account history is separately authenticated; redirects remain public. No throughput or latency improvement is claimed without measurement. Basic redirect counters are implemented; security scanning, load/stress testing, distributed infrastructure, detailed visitor analytics, expiry, and link status remain later work.
