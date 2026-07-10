package dev.syndata.entity;

import dev.syndata.model.ColumnModel;
import dev.syndata.model.SchemaModel;
import dev.syndata.model.TableModel;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.sql.Types;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class EntityScannerTest {

    @Test
    void camelToSnake() {
        assertEquals("order_item", EntityScanner.camelToSnake("OrderItem"));
        assertEquals("customer", EntityScanner.camelToSnake("Customer"));
        assertEquals("address_line1", EntityScanner.camelToSnake("addressLine1"));
    }

    @Test
    void enrichesEnumColumnsFromCompiledTestEntities() {
        SchemaModel schema = new SchemaModel();
        schema.schemaName = "public";
        TableModel t = new TableModel("public", "sample_entity");
        t.columns.add(new ColumnModel("mood", "varchar", Types.VARCHAR, false));
        t.columns.add(new ColumnModel("contact_email", "varchar", Types.VARCHAR, true));
        schema.tables.add(t);

        // The compiled test classes directory contains SampleEntity below.
        Path classesDir = Path.of(EntityScannerTest.class.getProtectionDomain()
                .getCodeSource().getLocation().getPath());
        int enriched = new EntityScanner(msg -> {
        }).enrich(schema, List.of(classesDir), "dev.syndata.entity");

        assertEquals(2, enriched);
        assertEquals(List.of("HAPPY", "GRUMPY"), t.column("mood").semanticValues);
        assertEquals("EMAIL", t.column("contact_email").semantic);
    }
}
