package dev.syndata.db;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Properties;

/** Opens JDBC connections and validates identifiers used in dynamically built SQL. */
public final class Db {

    private Db() {
    }

    public static Connection connect(String url, String user, String password) throws SQLException {
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException(
                    "No database URL. Pass --url, set SYNDATA_DB_URL, or put db.url in the config file.");
        }
        Properties props = new Properties();
        if (user != null) {
            props.setProperty("user", user);
        }
        if (password != null) {
            props.setProperty("password", password);
        }
        props.setProperty("ApplicationName", "syndata");
        return DriverManager.getConnection(url, props);
    }

    /** Double-quotes an identifier for safe inclusion in SQL. */
    public static String quote(String identifier) {
        return '"' + identifier.replace("\"", "\"\"") + '"';
    }

    /** Quotes a possibly schema-qualified name like {@code public.hibernate_sequence}. */
    public static String quoteQualified(String qualified) {
        int dot = qualified.indexOf('.');
        if (dot < 0) {
            return quote(qualified);
        }
        return quote(qualified.substring(0, dot)) + "." + quote(qualified.substring(dot + 1));
    }
}
