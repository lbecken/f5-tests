package dev.syndata.gen;

import dev.syndata.model.ColumnModel;
import dev.syndata.model.DataSetModel;
import dev.syndata.model.ForeignKeyModel;
import dev.syndata.model.SchemaModel;
import dev.syndata.model.TableDataModel;
import dev.syndata.model.TableModel;
import dev.syndata.model.UniqueModel;
import org.junit.jupiter.api.Test;

import java.sql.Types;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DataGeneratorTest {

    private static final String SEQ = "public.hibernate_sequence";

    private SchemaModel schema() {
        SchemaModel schema = new SchemaModel();
        schema.schemaName = "public";
        schema.globalSequence = SEQ;

        TableModel customers = new TableModel("public", "customers");
        customers.columns.add(seqPk());
        customers.columns.add(col("email", "varchar", Types.VARCHAR, false, 150));
        customers.columns.add(col("first_name", "varchar", Types.VARCHAR, false, 60));
        customers.columns.add(col("status", "varchar", Types.VARCHAR, false, 20));
        customers.column("status").checkValues = List.of("ACTIVE", "INACTIVE");
        customers.primaryKey.add("id");
        customers.uniqueConstraints.add(new UniqueModel("uq_email", List.of("email")));

        TableModel orders = new TableModel("public", "orders");
        orders.columns.add(seqPk());
        orders.columns.add(col("customer_id", "int8", Types.BIGINT, false, null));
        orders.primaryKey.add("id");
        ForeignKeyModel fk = new ForeignKeyModel("fk_orders_customer", "public", "customers");
        fk.columns.add("customer_id");
        fk.referencedColumns.add("id");
        orders.foreignKeys.add(fk);

        TableModel tags = new TableModel("public", "tags");
        tags.columns.add(seqPk());
        tags.columns.add(col("name", "varchar", Types.VARCHAR, false, 40));
        tags.primaryKey.add("id");
        tags.uniqueConstraints.add(new UniqueModel("uq_tag_name", List.of("name")));

        TableModel orderTag = new TableModel("public", "order_tag");
        orderTag.joinTable = true;
        orderTag.columns.add(col("order_id", "int8", Types.BIGINT, false, null));
        orderTag.columns.add(col("tag_id", "int8", Types.BIGINT, false, null));
        orderTag.primaryKey.addAll(List.of("order_id", "tag_id"));
        ForeignKeyModel fkOrder = new ForeignKeyModel("fk_ot_order", "public", "orders");
        fkOrder.columns.add("order_id");
        fkOrder.referencedColumns.add("id");
        ForeignKeyModel fkTag = new ForeignKeyModel("fk_ot_tag", "public", "tags");
        fkTag.columns.add("tag_id");
        fkTag.referencedColumns.add("id");
        orderTag.foreignKeys.addAll(List.of(fkOrder, fkTag));

        schema.tables.addAll(List.of(orderTag, orders, customers, tags));
        return schema;
    }

    private static ColumnModel seqPk() {
        ColumnModel id = col("id", "int8", Types.BIGINT, false, null);
        id.sequence = SEQ;
        return id;
    }

    private static ColumnModel col(String name, String type, int jdbcType, boolean nullable, Integer length) {
        ColumnModel c = new ColumnModel(name, type, jdbcType, nullable);
        c.length = length;
        return c;
    }

    private DataSetModel generate(int rows) {
        DataGenerator.Options opts = new DataGenerator.Options(rows, Map.of(), 42L, 0.1,
                Locale.ENGLISH, null);
        return new DataGenerator(msg -> {
        }).generate(schema(), opts);
    }

    private static TableDataModel table(DataSetModel data, String name) {
        return data.tables.stream().filter(t -> t.name.equals(name)).findFirst().orElseThrow();
    }

    @Test
    void generatesRequestedRowCountsInDependencyOrder() {
        DataSetModel data = generate(10);
        List<String> order = data.tables.stream().map(t -> t.name).toList();
        assertTrue(order.indexOf("customers") < order.indexOf("orders"));
        assertTrue(order.indexOf("orders") < order.indexOf("order_tag"));
        assertEquals(10, table(data, "customers").rows.size());
        assertEquals(10, table(data, "orders").rows.size());
    }

    @Test
    void sequencePksAreUniqueNegativeLocalIds() {
        DataSetModel data = generate(8);
        TableDataModel customers = table(data, "customers");
        int idIdx = customers.columns.indexOf("id");
        Set<Long> ids = new HashSet<>();
        for (List<Object> row : customers.rows) {
            long id = ((Number) row.get(idIdx)).longValue();
            assertTrue(id < 0, "local ids must be negative");
            assertTrue(ids.add(id), "local ids must be unique");
        }
    }

    @Test
    void foreignKeysReferenceGeneratedParents() {
        DataSetModel data = generate(12);
        int customerIdIdx = table(data, "customers").columns.indexOf("id");
        Set<Object> customerIds = new HashSet<>();
        table(data, "customers").rows.forEach(r -> customerIds.add(r.get(customerIdIdx)));

        TableDataModel orders = table(data, "orders");
        int fkIdx = orders.columns.indexOf("customer_id");
        for (List<Object> row : orders.rows) {
            assertNotNull(row.get(fkIdx), "customer_id is NOT NULL");
            assertTrue(customerIds.contains(row.get(fkIdx)), "FK must point at a generated customer");
        }
    }

    @Test
    void checkConstraintValuesAreRespected() {
        DataSetModel data = generate(20);
        TableDataModel customers = table(data, "customers");
        int statusIdx = customers.columns.indexOf("status");
        for (List<Object> row : customers.rows) {
            assertTrue(List.of("ACTIVE", "INACTIVE").contains(row.get(statusIdx)));
        }
    }

    @Test
    void uniqueColumnsHaveNoDuplicates() {
        DataSetModel data = generate(30);
        TableDataModel customers = table(data, "customers");
        int emailIdx = customers.columns.indexOf("email");
        Set<Object> emails = new HashSet<>();
        for (List<Object> row : customers.rows) {
            assertTrue(emails.add(row.get(emailIdx)), "duplicate email generated");
        }
    }

    @Test
    void joinTableCombinationsAreUnique() {
        DataSetModel data = generate(15);
        TableDataModel joins = table(data, "order_tag");
        Set<String> combos = new HashSet<>();
        for (List<Object> row : joins.rows) {
            assertTrue(combos.add(row.get(0) + "|" + row.get(1)), "duplicate join-table pair");
        }
        assertTrue(joins.rows.size() > 0);
    }

    @Test
    void rangeCheckBoundsAreRespected() {
        SchemaModel s = new SchemaModel();
        s.schemaName = "public";
        TableModel t = new TableModel("public", "reviews");
        t.columns.add(col("rating", "numeric", Types.NUMERIC, false, null));
        ColumnModel rating = t.column("rating");
        rating.precision = 2;
        rating.scale = 1;
        rating.checkMin = new java.math.BigDecimal("0");
        rating.checkMax = new java.math.BigDecimal("5");
        t.columns.add(col("attempts", "int4", Types.INTEGER, false, null));
        ColumnModel attempts = t.column("attempts");
        attempts.checkMin = new java.math.BigDecimal("0");
        attempts.checkMinExclusive = true;
        s.tables.add(t);

        DataSetModel data = new DataGenerator(m -> {
        }).generate(s, new DataGenerator.Options(50, Map.of(), 1L, 0.0, Locale.ENGLISH, null));
        TableDataModel rows = table(data, "reviews");
        int rIdx = rows.columns.indexOf("rating");
        int aIdx = rows.columns.indexOf("attempts");
        for (List<Object> row : rows.rows) {
            java.math.BigDecimal r = new java.math.BigDecimal(row.get(rIdx).toString());
            assertTrue(r.compareTo(java.math.BigDecimal.ZERO) >= 0 && r.compareTo(new java.math.BigDecimal("5")) <= 0,
                    "rating out of range: " + r);
            assertTrue(((Number) row.get(aIdx)).longValue() > 0, "attempts must be > 0");
        }
    }

    @Test
    void foreignKeysFallBackToExistingKeysFromStubTables() {
        SchemaModel s = new SchemaModel();
        s.schemaName = "public";
        s.globalSequence = SEQ;

        TableModel customers = new TableModel("public", "customers");
        customers.existingOnly = true;
        customers.columns.add(col("id", "int8", Types.BIGINT, false, null));
        customers.primaryKey.add("id");
        customers.existingKeys = List.of(List.of(101L), List.of(102L), List.of(103L));

        TableModel orders = new TableModel("public", "orders");
        orders.columns.add(seqPk());
        orders.columns.add(col("customer_id", "int8", Types.BIGINT, false, null));
        orders.primaryKey.add("id");
        ForeignKeyModel fk = new ForeignKeyModel("fk", "public", "customers");
        fk.columns.add("customer_id");
        fk.referencedColumns.add("id");
        orders.foreignKeys.add(fk);
        s.tables.addAll(List.of(orders, customers));

        DataSetModel data = new DataGenerator(m -> {
        }).generate(s, new DataGenerator.Options(20, Map.of(), 5L, 0.0, Locale.ENGLISH, null));

        assertEquals(1, data.tables.size(), "stub tables must not appear in the data file");
        TableDataModel o = table(data, "orders");
        int fkIdx = o.columns.indexOf("customer_id");
        for (List<Object> row : o.rows) {
            long v = ((Number) row.get(fkIdx)).longValue();
            assertTrue(v >= 101 && v <= 103, "FK must use an existing key, got " + v);
        }
    }

    @Test
    void sameSeedGivesSameData() {
        assertEquals(toStrings(generate(5)), toStrings(generate(5)));
    }

    private static String toStrings(DataSetModel data) {
        StringBuilder sb = new StringBuilder();
        for (TableDataModel t : data.tables) {
            sb.append(t.name).append(t.rows);
        }
        return sb.toString();
    }
}
