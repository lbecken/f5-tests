package dev.syndata.io;

import dev.syndata.model.DataSetModel;
import dev.syndata.model.TableDataModel;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.io.Writer;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * Writes a data set as one RFC 4180 CSV file per table (header row included),
 * for inspection in spreadsheets or import into other tools. Note that
 * sequence-backed ids keep their negative local values — only {@code insert}
 * and {@code sql} translate them into real sequence values.
 */
public final class CsvExporter {

    private CsvExporter() {
    }

    /** @return number of files written */
    public static int export(DataSetModel data, Path dir) {
        try {
            Files.createDirectories(dir);
            for (TableDataModel table : data.tables) {
                try (Writer w = Files.newBufferedWriter(dir.resolve(table.name + ".csv"))) {
                    writeRow(w, table.columns);
                    for (List<Object> row : table.rows) {
                        writeRow(w, row);
                    }
                }
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot write CSV files to " + dir, e);
        }
        return data.tables.size();
    }

    private static void writeRow(Writer w, List<?> values) throws IOException {
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                w.write(",");
            }
            w.write(field(values.get(i)));
        }
        w.write("\r\n");
    }

    static String field(Object value) {
        if (value == null) {
            return "";
        }
        String s = value instanceof BigDecimal bd ? bd.toPlainString() : value.toString();
        if (s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r")) {
            return '"' + s.replace("\"", "\"\"") + '"';
        }
        return s;
    }
}
