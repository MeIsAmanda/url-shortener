package com.amanda.urlshortener.link;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class DatabaseLinkIdAllocator implements LinkIdAllocator {
    private final JdbcTemplate jdbc;

    public DatabaseLinkIdAllocator(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public long nextId() {
        // The shared database coordinates callers. No JVM-local counter or MAX(id) + 1.
        Long id = jdbc.queryForObject("SELECT NEXT VALUE FOR short_link_id_seq", Long.class);
        if (id == null || id <= 0) {
            throw new IllegalStateException("The database did not allocate a positive link ID.");
        }
        return id;
    }
}
