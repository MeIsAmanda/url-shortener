package com.amanda.urlshortener.link;

import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ShortLinkServiceTest {
    private ShortLinkRepository repository;
    private CodeGenerator generator;
    private ShortLinkService service;
    private static final String ORIGINAL = "https://example.com/a/long/destination?campaign=assessment#section";

    @BeforeEach
    void setUp() {
        repository = mock(ShortLinkRepository.class);
        generator = mock(CodeGenerator.class);
        service = new ShortLinkService(repository, generator, new UrlValidator(), "http://localhost:8080/");
        when(generator.generate()).thenReturn("Abc1234");
    }

    @Test
    void savesMappingAndReturnsStrictlyShorterUrl() {
        CreateLinkResponse response = service.create("  " + ORIGINAL + "  ");
        assertEquals(ORIGINAL, response.originalUrl());
        assertEquals("http://localhost:8080/s/Abc1234", response.shortUrl());
        assertTrue(response.shortUrl().length() < ORIGINAL.length());
        verify(repository).saveAndFlush(argThat(link -> link.getCode().equals("Abc1234") && link.getOriginalUrl().equals(ORIGINAL)));
    }

    @Test
    void rejectsEqualLengthAndShorterInputsWithoutSaving() {
        int outputLength = "http://localhost:8080/s/Abc1234".length();
        String prefix = "https://example.com/";
        assertThrows(InvalidUrlException.class, () -> service.create(prefix + "a".repeat(outputLength - prefix.length())));
        assertThrows(InvalidUrlException.class, () -> service.create("https://x.co"));
        verifyNoInteractions(repository);
    }

    @Test
    void retriesAnInsertCollision() {
        when(generator.generate()).thenReturn("Abc1234", "Def5678");
        when(repository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("duplicate")).thenReturn(new ShortLink("Def5678", ORIGINAL));
        when(repository.existsByCode("Abc1234")).thenReturn(true);
        assertTrue(service.create(ORIGINAL).shortUrl().endsWith("Def5678"));
        verify(repository, times(2)).saveAndFlush(any());
    }

    @Test
    void limitsCollisionRetries() {
        when(repository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("duplicate"));
        when(repository.existsByCode(any())).thenReturn(true);
        assertThrows(IllegalStateException.class, () -> service.create(ORIGINAL));
        verify(repository, times(5)).saveAndFlush(any());
    }

    @Test
    void doesNotHideUnrelatedDatabaseErrors() {
        when(repository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("other failure"));
        assertThrows(DataIntegrityViolationException.class, () -> service.create(ORIGINAL));
        verify(repository).saveAndFlush(any());
    }

    @Test
    void resolvesSavedDestinationAndRejectsUnknownCode() {
        when(repository.findByCode("Abc1234")).thenReturn(Optional.of(new ShortLink("Abc1234", ORIGINAL)));
        assertEquals(ORIGINAL, service.resolve("Abc1234"));
        assertThrows(LinkNotFoundException.class, () -> service.resolve("Missing"));
        assertThrows(LinkNotFoundException.class, () -> service.resolve("!"));
    }

    @Test
    void rejectsUntrustedBaseConfiguration() {
        assertThrows(IllegalArgumentException.class,
            () -> new ShortLinkService(repository, generator, new UrlValidator(), "https://example.com?other=value"));
    }
}
