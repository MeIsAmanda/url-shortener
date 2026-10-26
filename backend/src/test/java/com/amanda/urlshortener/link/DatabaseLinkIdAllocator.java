package com.amanda.urlshortener.link;

import org.springframework.jdbc.core.JdbcTemplate;

/** Historical V2 sequence test helper; production allocation now uses Snowflake. */
class DatabaseLinkIdAllocator implements LinkIdAllocator {
    private final JdbcTemplate jdbc;

    DatabaseLinkIdAllocator(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Override
    public long nextId() {
        Long id = jdbc.queryForObject("SELECT NEXT VALUE FOR short_link_id_seq", Long.class);
        if (id == null || id <= 0) throw new IllegalStateException("Invalid sequence ID.");
        return id;
    }
}
