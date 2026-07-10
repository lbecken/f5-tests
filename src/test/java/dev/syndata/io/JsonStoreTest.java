package dev.syndata.io;

import dev.syndata.model.ColumnModel;
import dev.syndata.model.DataSetModel;
import dev.syndata.model.SchemaModel;
import dev.syndata.model.TableDataModel;
import dev.syndata.model.TableModel;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.math.BigDecimal;
import java.nio.file.Path;
import java.sql.Types;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class JsonStoreTest {

    @TempDir
    Path dir;

    @Test
    void schemaRoundTrip() {
        SchemaModel schema = new SchemaModel();
        schema.schemaName = "public";
        schema.globalSequence = "public.hibernate_sequence";
        TableModel t = new TableModel("public", "customers");
        ColumnModel id = new ColumnModel("id", "int8", Types.BIGINT, false);
        id.sequence = "public.hibernate_sequence";
        t.columns.add(id);
        t.primaryKey.add("id");
        schema.tables.add(t);

        Path file = dir.resolve("schema.json");
        JsonStore.writeSchema(schema, file);
        SchemaModel read = JsonStore.readSchema(file);

        assertEquals("public.hibernate_sequence", read.globalSequence);
        assertEquals(1, read.tables.size());
        assertEquals("id", read.tables.get(0).primaryKey.get(0));
        assertEquals("public.hibernate_sequence", read.tables.get(0).column("id").sequence);
    }

    @Test
    void dataRoundTripKeepsValueRepresentations() {
        DataSetModel data = new DataSetModel();
        data.seed = 42L;
        TableDataModel t = new TableDataModel("public", "things");
        t.columns = List.of("id", "price", "born", "at", "ok", "raw");
        t.rows.add(Arrays.asList(-5L, new BigDecimal("12.30"), LocalDate.of(2020, 1, 2),
                OffsetDateTime.of(2024, 6, 1, 10, 30, 0, 0, ZoneOffset.UTC), true, new byte[]{1, 2}));
        data.tables.add(t);

        Path file = dir.resolve("data.json");
        JsonStore.writeDataSet(data, file);
        DataSetModel read = JsonStore.readDataSet(file);

        List<Object> row = read.tables.get(0).rows.get(0);
        assertEquals(-5, ((Number) row.get(0)).longValue());
        assertEquals(new BigDecimal("12.30"), row.get(1));
        assertEquals("2020-01-02", row.get(2));
        assertEquals("2024-06-01T10:30:00Z", row.get(3));
        assertEquals(true, row.get(4));
        assertEquals("AQI=", row.get(5)); // bytea travels as base64
    }
}
