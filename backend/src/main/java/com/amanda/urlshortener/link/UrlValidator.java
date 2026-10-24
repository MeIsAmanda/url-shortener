package com.amanda.urlshortener.link;

import java.net.URI;
import java.net.URISyntaxException;
import org.springframework.stereotype.Component;

@Component
public class UrlValidator {
    public static final int MAX_LENGTH = 4096;

    public String validate(String input) {
        if (input == null || input.isBlank()) {
            throw new InvalidUrlException("Enter a URL including https:// or http://.");
        }
        // Reject controls before trimming so CR/LF cannot disappear during cleanup.
        if (input.chars().anyMatch(Character::isISOControl)) {
            throw new InvalidUrlException("URLs cannot contain control characters.");
        }
        String value = input.strip();
        if (value.length() > MAX_LENGTH) {
            throw new InvalidUrlException("URL must be at most " + MAX_LENGTH + " characters.");
        }
        try {
            URI uri = new URI(value).parseServerAuthority();
            if (!("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    || uri.getHost() == null || uri.getHost().isBlank()
                    || uri.getRawUserInfo() != null || uri.getPort() > 65535) {
                throw new InvalidUrlException("Enter a valid HTTP or HTTPS URL without embedded credentials.");
            }
        } catch (URISyntaxException ex) {
            throw new InvalidUrlException("Enter a valid URL including https:// or http://.");
        }
        return value;
    }
}
