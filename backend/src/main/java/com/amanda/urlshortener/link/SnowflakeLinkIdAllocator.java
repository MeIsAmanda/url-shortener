package com.amanda.urlshortener.link;

import java.time.Clock;
import java.time.Instant;
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** 41 timestamp bits, 10 worker bits, 12 sequence bits; the sign bit stays zero. */
@Component
public class SnowflakeLinkIdAllocator implements LinkIdAllocator {
    // 25 October 2026 00:00 Asia/Singapore. Never recompute on startup or change in place.
    public static final long EPOCH_MILLIS = Instant.parse("2026-10-24T16:00:00Z").toEpochMilli();
    public static final long MAX_TIMESTAMP = (1L << 41) - 1;
    public static final int MAX_WORKER_ID = 1023;
    private static final int MAX_SEQUENCE = 4095;
    private final SnowflakeTimestampStore store;
    private final int workerId;
    private final Clock clock;
    private final Runnable pause;
    private SnowflakeTimestampStore.Reservation window;
    private long lastTimestamp = -1;
    private int sequence;

    @Autowired
    public SnowflakeLinkIdAllocator(SnowflakeTimestampStore store,
            @Value("${app.snowflake.worker-id:0}") int workerId) {
        this(store, workerId, Clock.systemUTC(), () -> {
            try { Thread.sleep(1); }
            catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Interrupted while waiting for the Snowflake clock.", exception);
            }
        });
    }

    SnowflakeLinkIdAllocator(SnowflakeTimestampStore store, int workerId, Clock clock, Runnable pause) {
        if (workerId < 0 || workerId > MAX_WORKER_ID) {
            throw new IllegalArgumentException("Snowflake worker ID must be between 0 and 1023.");
        }
        this.store = store;
        this.workerId = workerId;
        this.clock = clock;
        this.pause = pause;
    }

    @Override
    public synchronized long nextId() {
        while (true) {
            long timestamp = timestamp();
            if (window == null || timestamp > window.lastMillis()) {
                window = store.reserve(workerId, timestamp);
            }
            if (timestamp < window.firstMillis()) {
                await(window.firstMillis());
                continue;
            }
            if (timestamp == lastTimestamp && sequence == MAX_SEQUENCE) {
                await(lastTimestamp + 1);
                continue;
            }
            sequence = timestamp == lastTimestamp ? sequence + 1 : 0;
            lastTimestamp = timestamp;
            return (timestamp << 22) | ((long) workerId << 12) | sequence;
        }
    }

    private long timestamp() {
        long timestamp = clock.millis() - EPOCH_MILLIS;
        if (timestamp < 0 || timestamp > MAX_TIMESTAMP) {
            throw new IllegalStateException("Clock is outside the fixed Snowflake epoch range.");
        }
        if (timestamp < lastTimestamp) {
            throw new IllegalStateException("Clock moved backwards; refusing to reuse Snowflake IDs.");
        }
        return timestamp;
    }

    private void await(long minimum) {
        long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(1200);
        while (timestamp() < minimum) {
            if (System.nanoTime() >= deadline) {
                throw new IllegalStateException("Snowflake clock did not advance in time.");
            }
            pause.run();
        }
    }
}
