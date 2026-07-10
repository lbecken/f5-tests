package dev.syndata;

import dev.syndata.cli.CsvCommand;
import dev.syndata.cli.GenerateCommand;
import dev.syndata.cli.InsertCommand;
import dev.syndata.cli.ScanCommand;
import dev.syndata.cli.SqlCommand;
import picocli.CommandLine;
import picocli.CommandLine.Command;

/** Entry point of the syndata CLI. */
@Command(name = "syndata", mixinStandardHelpOptions = true, version = "syndata 0.1.0",
        description = "Smart synthetic data for Postgres: scan a schema, generate FK-consistent "
                + "fake data, and load it back — with export/import files in between.",
        subcommands = {ScanCommand.class, GenerateCommand.class, InsertCommand.class,
                SqlCommand.class, CsvCommand.class})
public class Main implements Runnable {

    @Override
    public void run() {
        CommandLine.usage(this, System.out);
    }

    public static void main(String[] args) {
        CommandLine cmd = new CommandLine(new Main());
        cmd.setExecutionExceptionHandler((e, commandLine, parseResult) -> {
            System.err.println("Error: " + e.getMessage());
            if (System.getenv("SYNDATA_DEBUG") != null) {
                e.printStackTrace();
            }
            return 1;
        });
        System.exit(cmd.execute(args));
    }
}
