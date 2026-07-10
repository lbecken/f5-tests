package dev.syndata.io;

import dev.syndata.model.DataSetModel;
import dev.syndata.model.TableDataModel;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CsvExporterTest {

    @TempDir
    Path dir;

    @Test
    void escapesFieldsPerRfc4180() {
        assertEquals("", CsvExporter.field(null));
        assertEquals("plain", CsvExporter.field("plain"));
        assertEquals("\"a,b\"", CsvExporter.field("a,b"));
        assertEquals("\"say \"\"hi\"\"\"", CsvExporter.field("say \"hi\""));
        assertEquals("\"line1\nline2\"", CsvExporter.field("line1\nline2"));
        assertEquals("12.30", CsvExporter.field(new BigDecimal("12.30")));
        assertEquals("-5", CsvExporter.field(-5L));
    }

    @Test
    void writesOneFilePerTableWithHeader() throws Exception {
        DataSetModel data = new DataSetModel();
        TableDataModel t = new TableDataModel("public", "customers");
        t.columns = List.of("id", "name", "notes");
        t.rows.add(Arrays.asList(-1L, "Ada, Countess", null));
        data.tables.add(t);

        int files = CsvExporter.export(data, dir);

        assertEquals(1, files);
        List<String> lines = Files.readAllLines(dir.resolve("customers.csv"));
        assertEquals("id,name,notes", lines.get(0));
        assertEquals("-1,\"Ada, Countess\",", lines.get(1));
    }
}
