package dev.syndata.cli;

import dev.syndata.insert.SqlScriptExporter;
import dev.syndata.io.JsonStore;
import dev.syndata.model.DataSetModel;
import dev.syndata.model.SchemaModel;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

import java.nio.file.Path;
import java.util.concurrent.Callable;

@Command(name = "sql", mixinStandardHelpOptions = true,
        description = "Render a data file to a plain SQL script (single transaction). Ids are "
                + "allocated with nextval() inside the script, so it can be run with psql or any "
                + "SQL client on machines without syndata. No database connection needed.")
public class SqlCommand implements Callable<Integer> {

    @Option(names = {"-s", "--schema"}, defaultValue = "schema.json",
            description = "Schema file produced by 'scan' (default: ${DEFAULT-VALUE}).")
    Path schemaFile;

    @Option(names = {"-d", "--data"}, defaultValue = "data.json",
            description = "Data file produced by 'generate' (default: ${DEFAULT-VALUE}).")
    Path dataFile;

    @Option(names = {"-o", "--output"}, defaultValue = "load.sql",
            description = "SQL script to write (default: ${DEFAULT-VALUE}).")
    Path output;

    @Override
    public Integer call() {
        SchemaModel schema = JsonStore.readSchema(schemaFile);
        DataSetModel data = JsonStore.readDataSet(dataFile);
        int rows = new SqlScriptExporter(schema, data).export(output);
        System.out.println("Wrote " + output + " (" + rows + " rows, " + data.tables.size()
                + " table(s)). Run it with e.g.: psql -f " + output);
        return 0;
    }
}
