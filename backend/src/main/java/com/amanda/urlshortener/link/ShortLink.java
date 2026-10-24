package com.amanda.urlshortener.link;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "short_links", uniqueConstraints = @UniqueConstraint(name = "uk_short_link_code", columnNames = "code"))
public class ShortLink {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 7)
    private String code;

    @Column(nullable = false, length = UrlValidator.MAX_LENGTH)
    private String originalUrl;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected ShortLink() { }

    public ShortLink(String code, String originalUrl) {
        this.code = code;
        this.originalUrl = originalUrl;
        this.createdAt = Instant.now();
    }

    public String getCode() { return code; }
    public String getOriginalUrl() { return originalUrl; }
}
