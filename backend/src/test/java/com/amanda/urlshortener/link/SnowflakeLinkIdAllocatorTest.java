package com.amanda.urlshortener.link;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashSet;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SnowflakeLinkIdAllocatorTest {
    private SnowflakeTimestampStore store;
    private MutableClock clock;

    @BeforeEach
    void setUp() {
        store = mock(SnowflakeTimestampStore.class);
        clock = new MutableClock(1000);
        when(store.reserve(anyInt(), anyLong())).thenAnswer(invocation -> {
            long now = invocation.getArgument(1);
            return new SnowflakeTimestampStore.Reservation(now, now + 999);
        });
    }

    private SnowflakeLinkIdAllocator allocator(int worker) {
        return new SnowflakeLinkIdAllocator(store, worker, clock, () -> clock.elapsed++);
    }

    @Test
    void usesMidnightSingaporeOn25October2026AndTheClassicBitLayout() {
        assertEquals(Instant.parse("2026-10-24T16:00:00Z").toEpochMilli(), SnowflakeLinkIdAllocator.EPOCH_MILLIS);
        long id = allocator(37).nextId();
        assertEquals((1000L << 22) | (37L << 12), id);
        assertEquals(1000, id >>> 22);
        assertEquals(37, (id >>> 12) & 1023);
        assertEquals(0, id & 4095);
    }

    @ParameterizedTest
    @ValueSource(ints = {-1, 1024})
    void rejectsInvalidWorkerIds(int worker) {
        assertThrows(IllegalArgumentException.class, () -> allocator(worker));
    }

    @Test
    void differentWorkersAndSequencesRemainDistinctInTheSameMillisecond() {
        var ids = new HashSet<Long>();
        for (int worker : new int[]{0, 1, 1023}) {
            var generator = allocator(worker);
            for (int i = 0; i < 100; i++) assertTrue(ids.add(generator.nextId()));
        }
        assertEquals(300, ids.size());
    }

    @Test
    void waitsForNextMillisecondAfter4096IdsWithoutWrapping() {
        var generator = allocator(0);
        for (int sequence = 0; sequence < 4096; sequence++) {
            assertEquals((1000L << 22) | sequence, generator.nextId());
        }
        assertEquals(1001L << 22, generator.nextId());
        verify(store, times(1)).reserve(anyInt(), anyLong());
    }

    @Test
    void rejectsClockRollbackAndRecoversWithoutReusingAnId() {
        var generator = allocator(0);
        long first = generator.nextId();
        clock.elapsed--;
        assertThrows(IllegalStateException.class, generator::nextId);
        clock.elapsed++;
        assertEquals(first + 1, generator.nextId());
    }

    @Test
    void renewsOnlyWhenTheReservedWindowEnds() {
        var generator = allocator(0);
        generator.nextId();
        clock.elapsed = 1999;
        generator.nextId();
        verify(store, times(1)).reserve(anyInt(), anyLong());
        clock.elapsed = 2000;
        assertEquals(2000L << 22, generator.nextId());
        verify(store, times(2)).reserve(anyInt(), anyLong());
    }

    @Test
    void waitsOutAReservedWindowFromAPreviousProcess() {
        when(store.reserve(0, 1000)).thenReturn(new SnowflakeTimestampStore.Reservation(1005, 2004));
        assertEquals(1005L << 22, allocator(0).nextId());
    }

    @Test
    void rejectsDatesBeforeTheEpochOrAfterItsLifetime() {
        clock.elapsed = -1;
        assertThrows(IllegalStateException.class, () -> allocator(0).nextId());
        clock.elapsed = SnowflakeLinkIdAllocator.MAX_TIMESTAMP + 1;
        assertThrows(IllegalStateException.class, () -> allocator(0).nextId());
        verifyNoInteractions(store);
    }

    @Test
    void preservesTheFullPositiveLongRangeThroughBase62() {
        clock.elapsed = SnowflakeLinkIdAllocator.MAX_TIMESTAMP;
        when(store.reserve(anyInt(), anyLong())).thenReturn(new SnowflakeTimestampStore.Reservation(clock.elapsed, clock.elapsed));
        var generator = allocator(1023);
        long id = 0;
        for (int i = 0; i < 4096; i++) id = generator.nextId();
        assertEquals(Long.MAX_VALUE, id);
        assertEquals("AzL8n0Y58m7", new Base62Encoder().encode(id));
        assertThrows(IllegalStateException.class, generator::nextId);
    }

    @Test
    void reservationFailuresDoNotIssueIds() {
        when(store.reserve(anyInt(), anyLong())).thenThrow(new IllegalStateException("storage unavailable"));
        assertThrows(IllegalStateException.class, () -> allocator(0).nextId());
    }

    @Test
    void freshEpochWaitsForAPositiveIdAndCodesGrowWithElapsedTime() {
        clock.elapsed = 0;
        when(store.reserve(0, 0)).thenReturn(new SnowflakeTimestampStore.Reservation(1, 1000));
        assertEquals(1L << 22, allocator(0).nextId());
        clock.elapsed = 86_400_000;
        assertEquals(9, new Base62Encoder().encode(allocator(0).nextId()).length());
    }

    static class MutableClock extends Clock {
        long elapsed;
        MutableClock(long elapsed) { this.elapsed = elapsed; }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return Instant.ofEpochMilli(millis()); }
        @Override public long millis() { return SnowflakeLinkIdAllocator.EPOCH_MILLIS + elapsed; }
    }
}
