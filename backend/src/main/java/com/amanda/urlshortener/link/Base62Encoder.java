package com.amanda.urlshortener.link;

import org.springframework.stereotype.Component;

@Component
public class Base62Encoder {
    public static final int MAX_CODE_LENGTH = 11;
    private static final String ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

    public String encode(long id) {
        if (id < 0) {
            throw new IllegalArgumentException("ID must be nonnegative.");
        }
        StringBuilder code = new StringBuilder(MAX_CODE_LENGTH);
        do {
            code.append(ALPHABET.charAt((int) (id % ALPHABET.length())));
            id /= ALPHABET.length();
        } while (id > 0);
        return code.reverse().toString();
    }
}
