package com.amanda.urlshortener.link;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvFileSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;

class UrlValidatorTest {
    @ParameterizedTest
    @CsvFileSource(resources = "/validation/url-cases.tsv", delimiter = '\t', numLinesToSkip = 1,
            ignoreLeadingAndTrailingWhitespace = false)
    void followsTheSharedBackendAndFrontendPolicy(boolean valid, String input) {
        if (valid) assertDoesNotThrow(() -> UrlValidator.validate(input));
        else assertThrows(InvalidUrlException.class, () -> UrlValidator.validate(input));
    }

    @ParameterizedTest
    @NullAndEmptySource
    void requiresADestination(String input) {
        assertThrows(InvalidUrlException.class, () -> UrlValidator.validate(input));
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://example.com\n", "https://example.com\t", "https://example.com/\r\n",
        "https://example.com/?q=\u0000"})
    void rejectsControlCharactersThatBrowsersMightStrip(String input) {
        assertThrows(InvalidUrlException.class, () -> UrlValidator.validate(input));
    }

    @Test
    void enforcesTheExactLengthBoundary() {
        String atLimit = "https://example.com/" + "a".repeat(2048 - "https://example.com/".length());
        assertDoesNotThrow(() -> UrlValidator.validate(atLimit));
        assertThrows(InvalidUrlException.class, () -> UrlValidator.validate(atLimit + "a"));
    }
}
