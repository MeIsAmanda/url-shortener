package com.amanda.urlshortener.link;

import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.dao.DataIntegrityViolationException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ShortLinkServiceTest {
    private ShortLinkRepository repository;
    private LinkIdAllocator allocator;
    private ShortLinkService service;
    private static final String ORIGINAL = "https://example.com/a/long/destination?campaign=assessment#section";

    @BeforeEach
    void setUp() {
        repository = mock(ShortLinkRepository.class);
        allocator = mock(LinkIdAllocator.class);
        service = new ShortLinkService(repository, allocator, new Base62Encoder(), "http://localhost:8080/");
        when(allocator.nextId()).thenReturn(1_000_000L);
    }

    @Test
    void savesTheAllocatedIdAndItsBase62Code() {
        CreateLinkResponse response = service.create(ORIGINAL);
        assertEquals(ORIGINAL, response.originalUrl());
        assertEquals("http://localhost:8080/s/4C92", response.shortUrl());
        verify(repository).saveAndFlush(argThat(link -> link.getId() == 1_000_000L
                && link.getCode().equals("4C92") && link.getOriginalUrl().equals(ORIGINAL)));
        verify(allocator).nextId();
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://x.co", "HTTPS://Example.COM/a%20b?x=%2F&x=two+words#Section"})
    void savesValidUrlsWithoutRewritingOrOutputLengthComparison(String input) {
        CreateLinkResponse response = service.create(input);
        assertEquals(input, response.originalUrl());
        verify(repository).saveAndFlush(argThat(link -> input.equals(link.getOriginalUrl())));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "example.com", "not a URL", "https://example.com\r\n",
        "https://example.com/?q=%ZZ", "https://example.notarealtld"})
    void rejectsInvalidDestinationsBeforeAllocatingOrSaving(String input) {
        assertThrows(InvalidUrlException.class, () -> service.create(input));
        verifyNoInteractions(allocator, repository);
    }

    @Test
    void rejectsOverlongUrlsBeforeAllocating() {
        assertThrows(InvalidUrlException.class, () -> service.create("https://example.com/" + "a".repeat(2048)));
        verifyNoInteractions(allocator, repository);
    }

    @Test
    void givesRepeatedDestinationsDistinctAllocatedCodes() {
        when(allocator.nextId()).thenReturn(1_000_000L, 1_000_001L);
        assertTrue(service.create(ORIGINAL).shortUrl().endsWith("/4C92"));
        assertTrue(service.create(ORIGINAL).shortUrl().endsWith("/4C93"));
        verify(repository, times(2)).saveAndFlush(any());
    }

    @Test
    void doesNotRetryOrHideDatabaseIntegrityFailures() {
        when(repository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("insert failed"));
        assertThrows(DataIntegrityViolationException.class, () -> service.create(ORIGINAL));
        verify(repository).saveAndFlush(any());
        verify(allocator).nextId();
    }

    @Test
    void propagatesAnAllocatorFailureWithoutSaving() {
        when(allocator.nextId()).thenThrow(new IllegalStateException("sequence exhausted"));
        assertThrows(IllegalStateException.class, () -> service.create(ORIGINAL));
        verifyNoInteractions(repository);
    }

    @ParameterizedTest
    @ValueSource(strings = {"1", "10", "Abc1234", "AzL8n0Y58m7"})
    void resolvesVariableLengthAndLegacyCodesByTheirStoredMapping(String code) {
        when(repository.findByCode(code)).thenReturn(Optional.of(new ShortLink(123L, code, ORIGINAL)));
        assertEquals(ORIGINAL, service.resolve(code));
    }

    @Test
    void rejectsUnknownWellFormedCodes() {
        assertThrows(LinkNotFoundException.class, () -> service.resolve("Missing"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"!", "a_b", "123456789012", "a b"})
    void rejectsMalformedCodesBeforeQuerying(String code) {
        assertThrows(LinkNotFoundException.class, () -> service.resolve(code));
        verifyNoInteractions(repository);
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://example.com?other=value", "https://example.com/path", "https://user:pass@example.com",
        "https://example.com#fragment", "ftp://example.com", "https://example.com:65536"})
    void rejectsUntrustedBaseConfiguration(String base) {
        assertThrows(IllegalArgumentException.class,
            () -> new ShortLinkService(repository, allocator, new Base62Encoder(), base));
    }
}
