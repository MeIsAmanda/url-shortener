package com.amanda.urlshortener.link;

import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

@Service
public class ShortLinkService {
    private static final int MAX_ATTEMPTS = 5;
    private final ShortLinkRepository repository;
    private final CodeGenerator generator;
    private final UrlValidator validator;
    private final String publicBaseUrl;

    public ShortLinkService(ShortLinkRepository repository, CodeGenerator generator, UrlValidator validator,
            @Value("${app.public-base-url}") String publicBaseUrl) {
        this.repository = repository;
        this.generator = generator;
        this.validator = validator;
        // A configured origin avoids trusting the incoming Host header.
        URI base = URI.create(publicBaseUrl);
        if (!("http".equalsIgnoreCase(base.getScheme()) || "https".equalsIgnoreCase(base.getScheme()))
                || base.getHost() == null || base.getUserInfo() != null
                || base.getQuery() != null || base.getFragment() != null
                || !(base.getPath().isEmpty() || base.getPath().equals("/")) || base.getPort() > 65535) {
            throw new IllegalArgumentException("app.public-base-url must be an HTTP(S) origin.");
        }
        this.publicBaseUrl = publicBaseUrl.replaceAll("/+$", "");
    }

    public CreateLinkResponse create(String input) {
        String original = validator.validate(input);
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            String code = generator.generate();
            String shortened = publicBaseUrl + "/s/" + code;
            if (shortened.length() >= original.length()) {
                throw new InvalidUrlException("This URL is already too short to shorten with this service.");
            }
            try {
                // Each repository call has its own transaction. A collision rolls back
                // that insert before the next attempt; there is no outer transaction.
                repository.saveAndFlush(new ShortLink(code, original));
                return new CreateLinkResponse(original, shortened);
            } catch (DataIntegrityViolationException ex) {
                if (!repository.existsByCode(code)) {
                    throw ex; // Do not disguise unrelated database failures as collisions.
                }
            }
        }
        throw new IllegalStateException("Could not allocate a unique short code.");
    }

    public String resolve(String code) {
        if (!code.matches("[A-Za-z0-9]{7}")) { throw new LinkNotFoundException(); }
        return repository.findByCode(code).orElseThrow(LinkNotFoundException::new).getOriginalUrl();
    }
}
