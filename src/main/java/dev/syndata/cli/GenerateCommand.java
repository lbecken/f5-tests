package dev.syndata.cli;

import dev.syndata.ai.AiValuePool;
import dev.syndata.ai.LocalModelClient;
import dev.syndata.config.AppConfig;
import dev.syndata.gen.DataGenerator;
import dev.syndata.io.JsonStore;
import dev.syndata.model.DataSetModel;
import dev.syndata.model.SchemaModel;
import dev.syndata.model.TableDataModel;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.Callable;

@Command(name = "generate", mixinStandardHelpOptions = true,
        description = "Generate synthetic data from a schema file and export it to a data file. "
                + "No database connection needed.")
public class GenerateCommand implements Callable<Integer> {

    @Option(names = {"-c", "--config"}, description = "Properties file (used for ai.* settings).")
    Path configFile;

    @Option(names = {"-s", "--schema"}, defaultValue = "schema.json",
            description = "Schema file produced by 'scan' (default: ${DEFAULT-VALUE}).")
    Path schemaFile;

    @Option(names = {"-o", "--output"}, defaultValue = "data.json",
            description = "Data file to write (default: ${DEFAULT-VALUE}).")
    Path output;

    @Option(names = {"-n", "--rows"}, defaultValue = "10",
            description = "Rows to generate per table (default: ${DEFAULT-VALUE}).")
    int rows;

    @Option(names = {"-t", "--table-rows"},
            description = "Per-table row count override, e.g. -t orders=50 -t customers=20. "
                    + "Repeatable and comma-separable.")
    List<String> tableRows = new ArrayList<>();

    @Option(names = "--seed", description = "Random seed for reproducible data.")
    Long seed;

    @Option(names = "--null-ratio", defaultValue = "0.10",
            description = "Probability that a nullable non-FK column is NULL (default: ${DEFAULT-VALUE}).")
    double nullRatio;

    @Option(names = "--fk-skew", defaultValue = "1.0",
            description = "Skew of parent selection for foreign keys: 1 = uniform, 2-4 = "
                    + "Pareto-like (a few parents collect most references, e.g. some customers "
                    + "have many orders). Default: ${DEFAULT-VALUE}.")
    double fkSkew;

    @Option(names = "--locale", defaultValue = "en",
            description = "Locale for generated names, addresses etc. (default: ${DEFAULT-VALUE}).")
    String locale;

    @Option(names = "--ai",
            description = "Enrich free-text columns with values from a local Ollama model "
                    + "(config keys: ai.enabled, ai.url, ai.model). One model call per column.")
    boolean ai;

    @Override
    public Integer call() {
        SchemaModel schema = JsonStore.readSchema(schemaFile);
        AppConfig config = AppConfig.load(configFile);

        Map<String, Integer> perTable = new HashMap<>();
        for (String spec : tableRows) {
            for (String part : spec.split(",")) {
                String[] kv = part.trim().split("=", 2);
                if (kv.length != 2) {
                    System.err.println("Ignoring malformed --table-rows entry: " + part);
                    continue;
                }
                if (schema.table(kv[0].trim()) == null) {
                    System.err.println("Warning: --table-rows names unknown table '" + kv[0].trim() + "'.");
                }
                perTable.put(kv[0].trim(), Integer.parseInt(kv[1].trim()));
            }
        }

        AiValuePool aiPool = null;
        if (ai || config.getBoolean("ai.enabled", false)) {
            String url = config.get("ai.url", "http://localhost:11434");
            String model = config.get("ai.model", "llama3.2");
            System.err.println("AI enrichment enabled: " + model + " at " + url);
            aiPool = new AiValuePool(new LocalModelClient(url, model, System.err::println));
        }

        long actualSeed = seed != null ? seed : System.nanoTime();
        DataGenerator.Options opts = new DataGenerator.Options(rows, perTable, actualSeed,
                nullRatio, fkSkew, Locale.forLanguageTag(locale), aiPool);

        DataSetModel data = new DataGenerator(System.err::println).generate(schema, opts);
        JsonStore.writeDataSet(data, output);

        int total = 0;
        for (TableDataModel t : data.tables) {
            System.out.printf("  %-40s %5d rows%s%n", t.name, t.rows.size(),
                    t.deferredFkColumns.isEmpty() ? "" : " (deferred: " + t.deferredFkColumns + ")");
            total += t.rows.size();
        }
        System.out.println("Generated " + total + " rows for " + data.tables.size()
                + " table(s), seed " + actualSeed + ". Wrote " + output);
        return 0;
    }
}
