package com.amanda.urlshortener.link;

import java.security.SecureRandom;
import org.springframework.stereotype.Component;

@Component
public class CodeGenerator {
    private static final String ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    private final SecureRandom random = new SecureRandom();

    public String generate() {
        StringBuilder code = new StringBuilder(7);
        for (int i = 0; i < 7; i++) {
            code.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return code.toString();
    }
}
