package dev.syndata.analyze;

import dev.syndata.model.ColumnModel;
import dev.syndata.model.ForeignKeyModel;
import dev.syndata.model.SchemaModel;
import dev.syndata.model.TableModel;
import org.junit.jupiter.api.Test;

import java.sql.Types;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TableGraphTest {

    private static TableModel table(String name, String... columns) {
        TableModel t = new TableModel("public", name);
        for (String c : columns) {
            t.columns.add(new ColumnModel(c, "int8", Types.BIGINT, true));
        }
        return t;
    }

    private static void fk(TableModel from, String column, String toTable, boolean nullable) {
        ForeignKeyModel fk = new ForeignKeyModel("fk_" + from.name + "_" + column, "public", toTable);
        fk.columns.add(column);
        fk.referencedColumns.add("id");
        from.foreignKeys.add(fk);
        from.column(column).nullable = nullable;
    }

    @Test
    void parentsComeBeforeChildren() {
        SchemaModel schema = new SchemaModel();
        TableModel orders = table("orders", "id", "customer_id");
        TableModel customers = table("customers", "id");
        TableModel items = table("order_items", "id", "order_id");
        fk(orders, "customer_id", "customers", false);
        fk(items, "order_id", "orders", false);
        schema.tables.addAll(List.of(items, orders, customers));

        List<String> order = TableGraph.sort(schema).tables().stream().map(t -> t.name).toList();
        assertTrue(order.indexOf("customers") < order.indexOf("orders"));
        assertTrue(order.indexOf("orders") < order.indexOf("order_items"));
    }

    @Test
    void selfReferenceDoesNotBlockSorting() {
        SchemaModel schema = new SchemaModel();
        TableModel categories = table("categories", "id", "parent_id");
        fk(categories, "parent_id", "categories", true);
        schema.tables.add(categories);

        TableGraph.Order order = TableGraph.sort(schema);
        assertEquals(1, order.tables().size());
        assertTrue(order.deferredFkColumns().isEmpty());
    }

    @Test
    void cycleIsBrokenOnNullableFk() {
        SchemaModel schema = new SchemaModel();
        TableModel departments = table("departments", "id", "head_employee_id");
        TableModel employees = table("employees", "id", "department_id");
        fk(departments, "head_employee_id", "employees", true); // nullable: break here
        fk(employees, "department_id", "departments", false);
        schema.tables.addAll(List.of(departments, employees));

        TableGraph.Order order = TableGraph.sort(schema);
        List<String> names = order.tables().stream().map(t -> t.name).toList();
        assertEquals(List.of("departments", "employees"), names);
        assertEquals(java.util.Set.of("head_employee_id"), order.deferredFkColumns().get("departments"));
        assertTrue(order.warnings().isEmpty());
    }

    @Test
    void notNullCycleProducesWarning() {
        SchemaModel schema = new SchemaModel();
        TableModel a = table("a", "id", "b_id");
        TableModel b = table("b", "id", "a_id");
        fk(a, "b_id", "b", false);
        fk(b, "a_id", "a", false);
        schema.tables.addAll(List.of(a, b));

        TableGraph.Order order = TableGraph.sort(schema);
        assertEquals(2, order.tables().size());
        assertEquals(1, order.warnings().size());
    }
}
