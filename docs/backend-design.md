# Sequence IDs and Base62 codes

This revision replaces the random code generator with a database sequence and a separate encoder. The API and frontend contract remain `POST /api/urls` with `originalUrl` and `GET /s/{code}` for redirects.

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

Allocation reserves a number, not an empty row. `DatabaseLinkIdAllocator` obtains the next sequence value, and `saveAndFlush` inserts the mapping afterward. A failed insert can leave a skipped number without leaving a saved mapping. It may still incur database/log work; gaps do not mean that blank link rows accumulate.

Examples with the fixed alphabet `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`:

| ID | Code |
| ---: | --- |
| 1 | `1` |
| 10 | `A` |
| 35 | `Z` |
| 36 | `a` |
| 61 | `z` |
| 62 | `10` |
| 1,000,000 | `4C92` |

Codes grow as numbers grow, up to 11 characters for a positive Java long. There is no fixed seven-character promise. The numeric ID is increasing at allocation, but concurrent requests can finish in a different order. Base62 text also does not sort in numeric order across digit-length boundaries.

## Responsibilities

- `LinkIdAllocator`: interface separating the service from the ID source.
- `DatabaseLinkIdAllocator`: asks H2 for `NEXT VALUE FOR short_link_id_seq`; it has no local counter and never computes `MAX(id) + 1` during requests.
- `Base62Encoder`: converts an integer to a compact string without truncation, hashing, randomness, or database access.
- `UrlValidator`: creation-time format, length, and bundled-TLD checks without contacting the destination.
- `ShortLinkService`: validation, allocation, encoding, verbatim persistence of accepted values, and lookup.
- `ShortLink`: assigned primary key, unique code, original destination, and timestamp. `Persistable.isNew()` tells Spring Data to insert a newly constructed entity even though its ID is already present. Lifecycle callbacks mark persisted/loaded objects as existing.
- `ShortLinkRepository`: save and exact-code lookup.
- Flyway migrations: initialize/upgrade H2 once; Hibernate uses `ddl-auto=validate`.

The ID-source interface is an in-process boundary. It does not introduce another network service or prove horizontal scalability. Embedded H2 remains a single-instance local choice.

## Persistence, gaps, and failures

H2 is the embedded relational database used by this project. The default `jdbc:h2:file:./data/shortener` stores data in `backend/data/shortener.mv.db` when the backend is launched from `backend/`. Restarting from the same directory with the same database URL preserves mappings, schema history, and sequence state. A `jdbc:h2:mem:...` URL instead uses temporary in-memory storage, as in API/live-browser tests.

For a local backup, stop the backend and copy the whole `backend/data/` directory to a separate location. Restore that stopped database together with a compatible application version; do not combine mappings from one backup with allocator state from another. These local data files are ignored by Git, so committing the source does not back up saved links. A custom `DATABASE_URL` may store data elsewhere.

H2 sequence values are not returned after rollback. An insert failure can consume an ID without creating a row. Gaps are intentional. The sequence does not cycle: exhaustion causes failure, not reuse. [H2 sequence commands](https://www.h2database.com/html/commands.html#create_sequence), [sequence expression semantics](https://www.h2database.com/html/grammar.html#sequence_value_expression).

Do not reset or recreate the sequence on normal startup, manually reuse IDs, or copy independent databases into a common code namespace without a migration strategy. A future shared database must preserve allocator state with the mappings, including through failover and restore.

The application configures Hikari's connection initialization SQL to `SET WRITE_DELAY 0`. H2's default is a 500 ms delay between committing and flushing the log; an abrupt stop immediately after a successful response exposed that window during verification. The explicit setting also applies when a custom H2 `DATABASE_URL` is supplied. It removes the configured delay, with a potential write-latency cost that has not been benchmarked. Hardware/power-loss durability is outside these checks. This setting is H2-specific and must be revisited with a different database. [H2 write-delay setting](https://www.h2database.com/html/commands.html#set_write_delay).

Spring Data's normal new-entity detection treats non-null IDs as existing without a version field. The `Persistable` lifecycle pattern prevents a duplicate assigned ID from silently entering an update/merge path. [Spring Data entity persistence](https://docs.spring.io/spring-data/jpa/reference/jpa/entity-persistence.html).

## Existing database compatibility

V1, V2, and V3 are ordered schema revisions applied to the same database, not separate database servers. V3 runs after the ID migration described below and widens only the destination column. Existing destinations are retained, with no trimming or reallocation.

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
| Counter IDs are always more scalable than random IDs | Not established. This implementation removes random-code retries but adds a sequence allocation query. Coordination, storage writes, and redirect traffic still matter. |
| All proposed ID sources offer equivalent guarantees | No. Durability, failover, worker identity, clock behavior, and coordination differ. This implementation uses H2 only. |
| This describes Bitly's exact implementation | Not verified. Bitly's public API describes the interface, not sufficient internal allocator details to make that claim. [Bitly API](https://dev.bitly.com/api-reference/) |

The earlier notes about database checks also need precision: a sequence removes the need to check a candidate before insertion, but the database still enforces the unique indexes. The old implementation already avoided a pre-insert existence query.

Sequential public codes are predictable and enumerable; they do not provide authorization or confidentiality. No throughput or latency improvement is claimed without measurement. Security scanning, load/stress testing, distributed infrastructure, click analytics, expiry, and link status remain later work.
