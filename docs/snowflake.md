# Snowflake IDs and Base62 codes

Implemented on 25 October 2026. New links use Snowflake IDs instead of the V2 database sequence. The existing Base62 encoder, HTTP API, mappings, Google accounts, click counts, and URL validation remain in place.

## Fixed epoch and format

The epoch is **25 October 2026 at 00:00 Asia/Singapore**, the same instant as **24 October 2026 at 16:00 UTC**. It is a constant in the allocator and V5 migration, not the current date recalculated on startup. V5 also stores it in the database; allocation refuses an epoch mismatch.

```text
0 sign bit | 41 elapsed-millisecond bits | 10 worker bits | 12 counter bits

id = ((nowMillis - epochMillis) << 22) | (workerId << 12) | counter
publicCode = Base62(id)
```

The worker field combines the original design's datacenter/worker fields into one 0–1023 identity. A worker has 4,096 counter values per millisecond. After using them, it waits for a new millisecond rather than wrapping. This is format capacity, not a measured application throughput figure. The 41-bit timestamp lasts about 69.7 years from the fixed epoch; generation fails when the range is exhausted.

Codes are case-sensitive, unpadded, and at most 11 characters. They grow with elapsed time, even with very few links: the classic layout needs nine Base62 characters after one day and ten after one year. This is structured, roughly time-ordered allocation; it does not scramble codes or make them private.

## Classes and request flow

1. `ShortLinkService` validates the destination before allocating an ID.
2. `SnowflakeLinkIdAllocator` synchronizes counter changes within the process, checks the clock, and assembles the ID.
3. `SnowflakeTimestampStore` commits a durable worker timestamp reservation when needed.
4. `Base62Encoder` converts the complete positive ID without hashing or truncation.
5. The repository inserts the assigned ID and code. Database primary-key/code constraints remain authoritative.

Allocation does not create an empty link row. Failed insertions can leave unused IDs. Redirects query the exact saved alias; they do not decode an ID or revalidate old destinations.

## Why timestamp reservations exist

A process-local timestamp and counter alone cannot remember what an abruptly stopped process already issued. This implementation reserves up to **1,000 milliseconds** at a time in `snowflake_workers`, using a row lock and an independent transaction. Generation inside the current reservation uses memory; the next reservation requires database access. Idle gaps skip obsolete milliseconds instead of reserving every intervening window.

A restarted generator skips the previous reservation entirely. It may wait about one second before it can generate again. Two generators sharing the same database cannot reserve overlapping windows for the same worker. Independently deployed generators must still have distinct worker identities, especially when using separate databases. There is no automatic worker discovery, leasing, or cross-database coordination.

The generator refuses a clock that moves behind its last issued timestamp. Waiting for a reserved start/counter rollover is bounded to 1.2 seconds; a stuck clock fails the request. A reservation more than one second ahead of the current clock is rejected. A database outage can prevent reservation renewal even though the bit-packing algorithm itself is local. These failures propagate as server errors; no successful link response is returned without insertion.

Reservations commit independently of the link insert. Existing `SET WRITE_DELAY 0` applies to their H2 writes as well. This is an extra durability mechanism compared with the original in-memory algorithm, with database/latency costs that have not been benchmarked.

## Configuration and local use

The default worker ID is zero, suitable for one local backend. Optional PowerShell configuration, from `backend/`:

```powershell
$env:SNOWFLAKE_WORKER_ID = '0'
.\mvnw.cmd spring-boot:run
```

For multiple backend instances, assign distinct IDs such as 0, 1, and 2. Valid IDs are 0–1023; invalid configuration fails application startup. IDs need a consistent namespace and the same fixed epoch. Do not start several embedded H2 backends against one file; a real multi-instance deployment needs supported shared database and session infrastructure. Assigning a worker ID does not create multiple databases or shard the mappings.

## Existing databases and backup

V1–V4 are unchanged. **V5** scans existing row IDs and Base62 numeric alias values, and reads the old sequence's next value without consuming it. It records a safe legacy ID floor, the fixed epoch, and initializes 1,024 worker reservation rows. New Snowflake timestamps begin above that floor, so no existing row ID or alias can be regenerated. Leading-zero aliases keep their exact strings. Existing ownership, timestamps, counters, and destinations are untouched. The old sequence is retained as historical state and is no longer the production allocator.

If legacy data occupies a timestamp ahead of the current clock, creation fails until a safe timestamp is available; it does not silently advance the clock or overwrite links. Exhausted legacy ranges fail migration. Account history remains ordered by ID; V5 puts new IDs above legacy IDs, while concurrent workers are only approximately time-ordered.

Before first V5 startup, stop the backend and copy the entire `backend/data/` directory. Back up and restore mappings, Flyway history, Snowflake settings, and worker reservations together. Source control does not contain saved links. Do not reset the epoch/reservations, run an older writer alongside this version, or combine independently created databases without a migration. Restoring the previous application requires a compatible database backup.

## Verification and references

See [testing.md](testing.md) for clock-controlled unit cases, concurrent reservations, legacy migration/reopen, database-backed concurrent creation, and the packaged abrupt-stop/restart check. Concurrent service tests do not establish HTTP-server throughput. Dated execution results and limitations are in [verification.md](verification.md). Checks use isolated databases and never open development data.

The bit layout and rollover/clock behavior are based on [Twitter's original Snowflake worker](https://github.com/twitter-archive/snowflake/blob/snowflake-2010/src/main/scala/com/twitter/service/snowflake/IdWorker.scala). X describes the [time-ordered timestamp/worker/sequence structure](https://docs.x.com/fundamentals/x-ids). This is a Java implementation of that allocation model with a custom fixed epoch and durable reservations, not a claim to reproduce X's current internal service.
