package com.amanda.urlshortener.link;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.IDN;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/** Syntax-only policy: never resolves DNS or contacts the destination. */
public final class UrlValidator {
    public static final int MAX_LENGTH = 2048;
    private static final String FORMAT_ERROR = "Enter a valid web URL with correctly encoded special characters.";
    private static final String DOMAIN_ERROR = "Use a domain with a recognized ending, such as example.com.";
    private static final Pattern PARTS = Pattern.compile("(?i)^https?://([^/?#]+)(/[^?#]*)?(\\?[^#]*)?(#[^#]*)?$");
    private static final Pattern AUTHORITY = Pattern.compile("^([A-Za-z0-9.-]+)(?::([0-9]{1,5}))?$");
    private static final Pattern LABEL = Pattern.compile("[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?");
    private static final Pattern CHARACTERS = Pattern.compile("[A-Za-z0-9\\-._~:/?#\\[\\]@!$&'()*+,;=%]+");
    private static final Pattern SCHEME = Pattern.compile("(?i)^https?://");
    private static final Pattern BAD_ESCAPE = Pattern.compile("%(?![A-Fa-f0-9]{2})");
    private static final Set<String> TLDS = loadTlds();

    private UrlValidator() { }

    public static void validate(String input) {
        if (input == null || input.isEmpty()) {
            throw new InvalidUrlException("Enter a URL to shorten.");
        }
        if (input.length() > MAX_LENGTH) {
            throw new InvalidUrlException("Keep your URL to 2,048 characters or fewer.");
        }
        if (!SCHEME.matcher(input).find()) {
            throw new InvalidUrlException("Include http:// or https:// at the start.");
        }
        if (!CHARACTERS.matcher(input).matches() || BAD_ESCAPE.matcher(input).find()) {
            throw new InvalidUrlException(FORMAT_ERROR);
        }
        var parts = PARTS.matcher(input);
        if (!parts.matches()) throw new InvalidUrlException(FORMAT_ERROR);
        var authority = AUTHORITY.matcher(parts.group(1));
        if (!authority.matches()) throw new InvalidUrlException(DOMAIN_ERROR);
        String host = authority.group(1);
        String[] labels = host.split("\\.", -1);
        if (host.length() > 253 || labels.length < 2
                || !TLDS.contains(labels[labels.length - 1].toUpperCase(Locale.ROOT))) {
            throw new InvalidUrlException(DOMAIN_ERROR);
        }
        for (String label : labels) {
            if (!LABEL.matcher(label).matches()) throw new InvalidUrlException(DOMAIN_ERROR);
            if (label.toLowerCase(Locale.ROOT).startsWith("xn--") && IDN.toUnicode(label).equalsIgnoreCase(label)) {
                throw new InvalidUrlException(DOMAIN_ERROR);
            }
        }
        if (authority.group(2) != null) {
            int port = Integer.parseInt(authority.group(2));
            if (port < 1 || port > 65535) throw new InvalidUrlException(FORMAT_ERROR);
        }
        try {
            // URI is strict about malformed escapes and illegal path/query characters.
            if (URI.create(input).getHost() == null) throw new IllegalArgumentException();
        } catch (IllegalArgumentException ex) {
            throw new InvalidUrlException(FORMAT_ERROR);
        }
    }

    private static Set<String> loadTlds() {
        var resource = UrlValidator.class.getResourceAsStream("/validation/tlds.txt");
        if (resource == null) throw new IllegalStateException("Missing bundled TLD list.");
        try (var reader = new BufferedReader(new InputStreamReader(resource, StandardCharsets.US_ASCII))) {
            return reader.lines().map(String::trim).filter(line -> !line.isEmpty() && !line.startsWith("#"))
                    .collect(Collectors.toUnmodifiableSet());
        } catch (IOException ex) {
            throw new IllegalStateException("Cannot read bundled TLD list.", ex);
        }
    }
}
