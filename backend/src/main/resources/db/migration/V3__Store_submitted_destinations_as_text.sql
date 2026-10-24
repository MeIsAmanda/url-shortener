-- Destination strings are stored verbatim without the old 4096-character cap.
-- Alter the existing column without changing saved mappings or ID allocation.
ALTER TABLE short_links ALTER COLUMN original_url SET DATA TYPE CLOB;
