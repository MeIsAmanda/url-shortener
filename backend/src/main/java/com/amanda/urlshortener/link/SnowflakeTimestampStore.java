package com.amanda.urlshortener.link;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Durable, disjoint time windows protect worker IDs through process crashes. */
@Component
public class SnowflakeTimestampStore {
    public static final long WINDOW_MILLIS = 1000;
    private final JdbcTemplate jdbc;

    public record Reservation(long firstMillis, long lastMillis) { }

    public SnowflakeTimestampStore(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Reservation reserve(int workerId, long now) {
        var settings = jdbc.queryForMap("SELECT epoch_millis, legacy_id_floor FROM snowflake_settings WHERE id=1");
        if (((Number) settings.get("epoch_millis")).longValue() != SnowflakeLinkIdAllocator.EPOCH_MILLIS) {
            throw new IllegalStateException("Snowflake epoch differs from the persisted format.");
        }
        long floor = ((Number) settings.get("legacy_id_floor")).longValue();
        Long previous = jdbc.queryForObject("SELECT reserved_until_millis FROM snowflake_workers "
                + "WHERE worker_id=? FOR UPDATE", Long.class, workerId);
        if (previous == null) throw new IllegalStateException("Missing Snowflake worker state.");
        long first = Math.max(now, Math.max(previous + 1, (floor >>> 22) + 1));
        if (first > SnowflakeLinkIdAllocator.MAX_TIMESTAMP || first - now > WINDOW_MILLIS) {
            throw new IllegalStateException("Clock has not reached a safe Snowflake timestamp, or the format is exhausted.");
        }
        long last = Math.min(SnowflakeLinkIdAllocator.MAX_TIMESTAMP, first + WINDOW_MILLIS - 1);
        jdbc.update("UPDATE snowflake_workers SET reserved_until_millis=? WHERE worker_id=?", last, workerId);
        return new Reservation(first, last);
    }
}
