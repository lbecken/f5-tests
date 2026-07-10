package dev.syndata.cli;

import dev.syndata.io.CsvExporter;
import dev.syndata.io.JsonStore;
import dev.syndata.model.DataSetModel;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

import java.nio.file.Path;
import java.util.concurrent.Callable;

@Command(name = "csv", mixinStandardHelpOptions = true,
        description = "Export a data file as one CSV file per table (with header row), for "
                + "spreadsheets or other tools. Sequence-backed ids keep their negative local "
                + "values; use 'insert' or 'sql' to load data with real ids.")
public class CsvCommand implements Callable<Integer> {

    @Option(names = {"-d", "--data"}, defaultValue = "data.json",
            description = "Data file produced by 'generate' (default: ${DEFAULT-VALUE}).")
    Path dataFile;

    @Option(names = {"-o", "--output"}, defaultValue = "csv",
            description = "Directory for the CSV files (default: ${DEFAULT-VALUE}).")
    Path outputDir;

    @Override
    public Integer call() {
        DataSetModel data = JsonStore.readDataSet(dataFile);
        int files = CsvExporter.export(data, outputDir);
        System.out.println("Wrote " + files + " CSV file(s) to " + outputDir + "/");
        return 0;
    }
}
