package db.migration;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/** One-time H2 migration; keep the historical alphabet fixed in this migration. */
public class V2__Sequence_based_codes extends BaseJavaMigration {
    private static final String LEGACY_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

    @Override
    public void migrate(Context context) throws SQLException {
        Connection connection = context.getConnection();
        long maximum = 0;
        // Old codes and primary keys were allocated independently. Reserve both
        // ranges so neither an existing row ID nor a public alias can be reused.
        try (Statement query = connection.createStatement();
                ResultSet rows = query.executeQuery("SELECT id, code FROM short_links")) {
            while (rows.next()) {
                maximum = Math.max(maximum, rows.getLong("id"));
                maximum = Math.max(maximum, decodeLegacyCode(rows.getString("code")));
            }
        }
        if (maximum == Long.MAX_VALUE) {
            throw new SQLException("No positive link IDs remain after the legacy data.");
        }
        try (Statement ddl = connection.createStatement()) {
            ddl.execute("ALTER TABLE short_links ALTER COLUMN code SET DATA TYPE VARCHAR(11)");
            ddl.execute("ALTER TABLE short_links ALTER COLUMN id DROP IDENTITY");
            // This number is computed from existing numeric data, not request input.
            ddl.execute("CREATE SEQUENCE short_link_id_seq AS BIGINT START WITH "
                    + (maximum + 1) + " INCREMENT BY 1 MINVALUE 1 NO CYCLE");
        }
    }

    private static long decodeLegacyCode(String code) throws SQLException {
        if (code == null || !code.matches("[A-Za-z0-9]{7}")) {
            throw new SQLException("Expected seven-character legacy codes before migration V2.");
        }
        long value = 0;
        for (int i = 0; i < code.length(); i++) {
            value = value * 62 + LEGACY_ALPHABET.indexOf(code.charAt(i));
        }
        return value;
    }
}
