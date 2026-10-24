package com.amanda.urlshortener.link;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;

class UrlValidatorTest {
    private final UrlValidator validator = new UrlValidator();

    @ParameterizedTest
    @ValueSource(strings = {"https://example.com/path?x=1&y=two#part", "http://example.com", "HTTPS://example.com/CaseSensitive"})
    void acceptsAndPreservesDestinations(String value) {
        assertEquals(value, validator.validate(value));
    }

    @Test
    void trimsSurroundingSpaces() {
        assertEquals("https://example.com", validator.validate("  https://example.com  "));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "example.com", "https://", "https:///path", "https://bad host.com", "javascript:alert(1)",
        "file:///etc/passwd", "ftp://example.com", "https://user:password@example.com", "https://example.com\r\n", "https://example.com:65536"})
    void rejectsInvalidInput(String value) {
        assertThrows(InvalidUrlException.class, () -> validator.validate(value));
    }

    @Test
    void enforcesLengthLimit() {
        String prefix = "https://example.com/";
        String atLimit = prefix + "a".repeat(UrlValidator.MAX_LENGTH - prefix.length());
        assertEquals(atLimit, validator.validate(atLimit));
        assertThrows(InvalidUrlException.class, () -> validator.validate(atLimit + "a"));
    }
}
