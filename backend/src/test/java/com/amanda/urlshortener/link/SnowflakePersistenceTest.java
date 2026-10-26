package com.amanda.urlshortener.link;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:snowflake-state;DB_CLOSE_DELAY=-1"})
class SnowflakePersistenceTest {
    @Autowired SnowflakeTimestampStore store;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactions;

    @BeforeEach
    void reset() {
        jdbc.update("UPDATE snowflake_workers SET reserved_until_millis=-1");
        jdbc.update("UPDATE snowflake_settings SET epoch_millis=?, legacy_id_floor=0", SnowflakeLinkIdAllocator.EPOCH_MILLIS);
    }

    @Test
    void aNewGeneratorSkipsThePreviousGeneratorsEntireReservation() {
        var clock = new SnowflakeLinkIdAllocatorTest.MutableClock(1000);
        var first = new SnowflakeLinkIdAllocator(store, 0, clock, () -> clock.elapsed++);
        assertEquals(1000L << 22, first.nextId());
        var restarted = new SnowflakeLinkIdAllocator(store, 0, clock, () -> clock.elapsed++);
        assertEquals(2000L << 22, restarted.nextId());
        assertEquals(2999L, jdbc.queryForObject("SELECT reserved_until_millis FROM snowflake_workers WHERE worker_id=0", Long.class));
    }

    @Test
    void reservationsCommitIndependentlyOfAFailedMappingInsert() {
        assertThrows(IllegalStateException.class, () -> new TransactionTemplate(transactions).execute(status -> {
            store.reserve(0, 1000);
            jdbc.update("INSERT INTO short_links(id, code, original_url, created_at) "
                    + "VALUES (42, 'rollback', 'https://example.com', CURRENT_TIMESTAMP)");
            throw new IllegalStateException("Simulated failed outer transaction");
        }));
        assertEquals(2000, store.reserve(0, 1000).firstMillis());
        assertEquals(0L, jdbc.queryForObject("SELECT COUNT(*) FROM short_links", Long.class));
    }

    @Test
    void simultaneousReservationsForOneWorkerCannotOverlap() throws Exception {
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> store.reserve(0, 1000));
            var second = executor.submit(() -> store.reserve(0, 1000));
            var a = first.get(10, TimeUnit.SECONDS);
            var b = second.get(10, TimeUnit.SECONDS);
            assertTrue(a.lastMillis() < b.firstMillis() || b.lastMillis() < a.firstMillis());
        }
    }

    @Test
    void workersReserveIndependentlyAndEpochMismatchIsRejected() {
        assertEquals(1000, store.reserve(0, 1000).firstMillis());
        assertEquals(1000, store.reserve(1, 1000).firstMillis());
        jdbc.update("UPDATE snowflake_settings SET epoch_millis=0");
        assertThrows(IllegalStateException.class, () -> store.reserve(2, 1000));
    }

    @Test
    void legacyFloorIsRespectedAndFutureOrExhaustedRangesFailSafely() {
        jdbc.update("UPDATE snowflake_settings SET legacy_id_floor=?", (1005L << 22) | 4095);
        assertEquals(1006, store.reserve(0, 1000).firstMillis());
        assertThrows(IllegalStateException.class, () -> store.reserve(0, 0));
        assertThrows(IllegalStateException.class,
                () -> store.reserve(1, SnowflakeLinkIdAllocator.MAX_TIMESTAMP + 1));
    }
}
