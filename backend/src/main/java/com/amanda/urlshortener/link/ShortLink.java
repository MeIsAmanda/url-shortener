package com.amanda.urlshortener.link;

import jakarta.persistence.*;
import java.time.Instant;
import org.springframework.data.domain.Persistable;

@Entity
@Table(name = "short_links", uniqueConstraints = @UniqueConstraint(name = "uk_short_link_code", columnNames = "code"))
public class ShortLink implements Persistable<Long> {
    @Id
    private Long id;

    @Column(nullable = false, length = Base62Encoder.MAX_CODE_LENGTH)
    private String code;

    @Lob
    @Column(nullable = false)
    private String originalUrl;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;
    @Column
    private Long ownerId;
    @Column(nullable = false)
    private long clickCount;

    @Transient
    private boolean newEntity = true;

    protected ShortLink() { }

    public ShortLink(long id, String code, String originalUrl) {
        this(id, code, originalUrl, null);
    }

    public ShortLink(long id, String code, String originalUrl, Long ownerId) {
        if (id <= 0) {
            throw new IllegalArgumentException("Link ID must be positive.");
        }
        this.id = id;
        this.code = code;
        this.originalUrl = originalUrl;
        this.ownerId = ownerId;
        this.createdAt = Instant.now();
    }

    @Override
    public Long getId() { return id; }

    // Assigned IDs are already non-null. Tell Spring Data to INSERT new entities
    // instead of treating them as existing rows and merging them.
    @Override
    public boolean isNew() { return newEntity; }

    @PostPersist
    @PostLoad
    private void markPersisted() { newEntity = false; }

    public String getCode() { return code; }
    public String getOriginalUrl() { return originalUrl; }
    public Long getOwnerId() { return ownerId; }
    public Instant getCreatedAt() { return createdAt; }
    public long getClickCount() { return clickCount; }
}
