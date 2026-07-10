package dev.syndata.cli;

import dev.syndata.db.Db;
import dev.syndata.insert.DataInserter;
import dev.syndata.io.JsonStore;
import dev.syndata.model.DataSetModel;
import dev.syndata.model.SchemaModel;
import dev.syndata.model.TableDataModel;
import picocli.CommandLine.Command;
import picocli.CommandLine.Mixin;
import picocli.CommandLine.Option;

import java.nio.file.Path;
import java.sql.Connection;
import java.util.concurrent.Callable;

@Command(name = "insert", mixinStandardHelpOptions = true,
        description = "Insert a generated data file into the database. Primary keys are allocated "
                + "from the real sequences (e.g. the Hibernate global sequence) and all foreign key "
                + "references are remapped accordingly. Runs in a single transaction.")
public class InsertCommand implements Callable<Integer> {

    @Mixin
    DbOptions db;

    @Option(names = {"-s", "--schema"}, defaultValue = "schema.json",
            description = "Schema file produced by 'scan' (default: ${DEFAULT-VALUE}).")
    Path schemaFile;

    @Option(names = {"-d", "--data"}, defaultValue = "data.json",
            description = "Data file produced by 'generate' (default: ${DEFAULT-VALUE}).")
    Path dataFile;

    @Option(names = "--batch-size", defaultValue = "500",
            description = "JDBC batch size (default: ${DEFAULT-VALUE}).")
    int batchSize;

    @Option(names = "--dry-run",
            description = "Print what would be inserted without touching the database.")
    boolean dryRun;

    @Option(names = "--truncate",
            description = "DELETES DATA: empty the tables listed in the data file before "
                    + "inserting (same transaction, no CASCADE — fails if outside tables still "
                    + "reference them; sequences are not reset).")
    boolean truncate;

    @Override
    public Integer call() throws Exception {
        SchemaModel schema = JsonStore.readSchema(schemaFile);
        DataSetModel data = JsonStore.readDataSet(dataFile);

        if (dryRun) {
            int total = 0;
            if (truncate) {
                System.out.println("Dry run; would truncate " + data.tables.size()
                        + " table(s) first.");
            }
            System.out.println("Dry run; insertion order:");
            for (TableDataModel t : data.tables) {
                System.out.printf("  %-40s %5d rows%s%n", t.name, t.rows.size(),
                        t.deferredFkColumns.isEmpty() ? ""
                                : " (FK columns updated after load: " + t.deferredFkColumns + ")");
                total += t.rows.size();
            }
            System.out.println("Would insert " + total + " rows into " + data.tables.size() + " table(s).");
            return 0;
        }

        long start = System.currentTimeMillis();
        try (Connection connection = Db.connect(db.resolvedUrl(), db.resolvedUser(), db.resolvedPassword())) {
            DataInserter inserter = new DataInserter(connection, batchSize, System.out::println);
            DataInserter.Report report = inserter.insert(schema, data, truncate);
            int total = report.insertedRows().values().stream().mapToInt(Integer::intValue).sum();
            System.out.println("Inserted " + total + " rows into " + report.insertedRows().size()
                    + " table(s)" + (report.deferredUpdates() > 0
                    ? " and applied " + report.deferredUpdates() + " deferred FK update(s)" : "")
                    + " in " + (System.currentTimeMillis() - start) + " ms.");
        }
        return 0;
    }
}
