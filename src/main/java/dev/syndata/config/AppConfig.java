package dev.syndata.config;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

/**
 * Configuration resolved from (highest precedence first):
 * CLI options, environment variables (SYNDATA_DB_URL / SYNDATA_DB_USER / SYNDATA_DB_PASSWORD),
 * a properties file passed with --config, and built-in defaults.
 */
public class AppConfig {

    public static final String ENV_URL = "SYNDATA_DB_URL";
    public static final String ENV_USER = "SYNDATA_DB_USER";
    public static final String ENV_PASSWORD = "SYNDATA_DB_PASSWORD";

    private final Properties props = new Properties();

    public static AppConfig load(Path configFile) {
        AppConfig cfg = new AppConfig();
        if (configFile != null) {
            try (InputStream in = Files.newInputStream(configFile)) {
                cfg.props.load(in);
            } catch (IOException e) {
                throw new IllegalArgumentException("Cannot read config file " + configFile + ": " + e.getMessage(), e);
            }
        }
        return cfg;
    }

    private String env(String name) {
        String v = System.getenv(name);
        return (v == null || v.isBlank()) ? null : v;
    }

    private String first(String cli, String envName, String propKey, String def) {
        if (cli != null && !cli.isBlank()) {
            return cli;
        }
        String e = env(envName);
        if (e != null) {
            return e;
        }
        String p = props.getProperty(propKey);
        if (p != null && !p.isBlank()) {
            return p.trim();
        }
        return def;
    }

    public String dbUrl(String cli) {
        return first(cli, ENV_URL, "db.url", null);
    }

    public String dbUser(String cli) {
        return first(cli, ENV_USER, "db.user", null);
    }

    public String dbPassword(String cli) {
        return first(cli, ENV_PASSWORD, "db.password", null);
    }

    public String get(String key, String def) {
        String p = props.getProperty(key);
        return (p == null || p.isBlank()) ? def : p.trim();
    }

    public boolean getBoolean(String key, boolean def) {
        String p = props.getProperty(key);
        return (p == null || p.isBlank()) ? def : Boolean.parseBoolean(p.trim());
    }
}
