package dev.syndata.cli;

import dev.syndata.config.AppConfig;
import picocli.CommandLine.Option;

import java.nio.file.Path;

/** Connection options shared by the commands that talk to the database. */
public class DbOptions {

    @Option(names = {"-c", "--config"},
            description = "Properties file with db.url / db.user / db.password and other settings.")
    public Path configFile;

    @Option(names = "--url",
            description = "JDBC URL, e.g. jdbc:postgresql://localhost:5432/mydb (env: SYNDATA_DB_URL).")
    public String url;

    @Option(names = {"-U", "--user"}, description = "Database user (env: SYNDATA_DB_USER).")
    public String user;

    @Option(names = {"-P", "--password"}, description = "Database password (env: SYNDATA_DB_PASSWORD).")
    public String password;

    @Option(names = "--db-schema", defaultValue = "public",
            description = "Database schema to work in (default: ${DEFAULT-VALUE}).")
    public String dbSchema;

    private AppConfig config;

    public AppConfig config() {
        if (config == null) {
            config = AppConfig.load(configFile);
        }
        return config;
    }

    public String resolvedUrl() {
        return config().dbUrl(url);
    }

    public String resolvedUser() {
        return config().dbUser(user);
    }

    public String resolvedPassword() {
        return config().dbPassword(password);
    }
}
