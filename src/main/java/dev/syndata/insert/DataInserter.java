package dev.syndata.insert;

import dev.syndata.db.Db;
import dev.syndata.model.ColumnModel;
import dev.syndata.model.DataSetModel;
import dev.syndata.model.ForeignKeyModel;
import dev.syndata.model.SchemaModel;
import dev.syndata.model.TableDataModel;
import dev.syndata.model.TableModel;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.stream.Collectors;

/**
 * Loads a generated data set into the database.
 *
 * <p>For every sequence-backed column (the Hibernate global sequence, serial and
 * identity columns) real values are allocated with {@code nextval()} up front, and
 * the negative local ids in the data file — including all foreign key references
 * to them — are remapped. FK columns that were deferred to break dependency cycles
 * are inserted as NULL and applied with batched UPDATEs at the end. Everything runs
 * in a single transaction.</p>
 */
public class DataInserter {

    public record Report(Map<String, Integer> insertedRows, int deferredUpdates) {
    }

    private final Connection connection;
    private final int batchSize;
    private final Consumer<String> log;

    public DataInserter(Connection connection, int batchSize, Consumer<String> log) {
        this.connection = connection;
        this.batchSize = batchSize;
        this.log = log;
    }

    public Report insert(SchemaModel schema, DataSetModel data, boolean truncate) throws SQLException {
        boolean oldAutoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try {
            if (truncate) {
                truncateTables(schema, data);
            }
            Map<Long, Long> idMap = new HashMap<>();
            Map<String, Integer> inserted = new LinkedHashMap<>();
            List<DeferredUpdate> deferredUpdates = new ArrayList<>();

            for (TableDataModel tableData : data.tables) {
                TableModel table = requireTable(schema, tableData.name);
                allocateSequenceValues(table, tableData, idMap);
                int rows = insertTable(schema, table, tableData, idMap, deferredUpdates);
                inserted.put(table.name, rows);
                log.accept("  " + table.qualifiedName() + ": " + rows + " rows");
            }

            int updates = applyDeferredUpdates(schema, deferredUpdates, idMap);
            connection.commit();
            return new Report(inserted, updates);
        } catch (SQLException | RuntimeException e) {
            connection.rollback();
            throw e;
        } finally {
            connection.setAutoCommit(oldAutoCommit);
        }
    }

    /**
     * Empties exactly the tables present in the data file, in one statement so FKs
     * among them do not matter. Deliberately no CASCADE: if a table outside the data
     * file still references these rows, the transaction fails instead of silently
     * wiping unrelated data. Sequences are not reset.
     */
    private void truncateTables(SchemaModel schema, DataSetModel data) throws SQLException {
        if (data.tables.isEmpty()) {
            return;
        }
        String targets = data.tables.stream()
                .map(t -> requireTable(schema, t.name))
                .map(t -> Db.quote(t.schema) + "." + Db.quote(t.name))
                .collect(Collectors.joining(", "));
        try (java.sql.Statement st = connection.createStatement()) {
            st.execute("truncate table " + targets);
        }
        log.accept("  truncated " + data.tables.size() + " table(s)");
    }

    private static TableModel requireTable(SchemaModel schema, String name) {
        TableModel table = schema.table(name);
        if (table == null) {
            throw new IllegalArgumentException("Table '" + name
                    + "' from the data file is not present in the schema file.");
        }
        return table;
    }

    /** Replaces the local ids of sequence-backed columns with freshly allocated sequence values. */
    private void allocateSequenceValues(TableModel table, TableDataModel data, Map<Long, Long> idMap)
            throws SQLException {
        for (int c = 0; c < data.columns.size(); c++) {
            ColumnModel col = table.column(data.columns.get(c));
            if (col == null || col.sequence == null) {
                continue;
            }
            List<Long> localIds = new ArrayList<>();
            for (List<Object> row : data.rows) {
                Object v = row.get(c);
                if (v instanceof Number n && n.longValue() < 0) {
                    localIds.add(n.longValue());
                }
            }
            if (localIds.isEmpty()) {
                continue;
            }
            String sql = "select nextval(?::regclass) from generate_series(1, ?)";
            try (PreparedStatement ps = connection.prepareStatement(sql)) {
                ps.setString(1, Db.quoteQualified(col.sequence));
                ps.setInt(2, localIds.size());
                try (ResultSet rs = ps.executeQuery()) {
                    int i = 0;
                    while (rs.next()) {
                        idMap.put(localIds.get(i++), rs.getLong(1));
                    }
                }
            }
        }
    }

    private record DeferredUpdate(String table, String column, Object pkValue, Object value) {
    }

    private int insertTable(SchemaModel schema, TableModel table, TableDataModel data,
                            Map<Long, Long> idMap, List<DeferredUpdate> deferredUpdates)
            throws SQLException {
        if (data.rows.isEmpty()) {
            return 0;
        }
        List<ColumnModel> cols = new ArrayList<>();
        for (String name : data.columns) {
            ColumnModel col = table.column(name);
            if (col == null) {
                throw new IllegalArgumentException("Column " + table.name + "." + name
                        + " from the data file is not present in the schema file.");
            }
            cols.add(col);
        }
        // Columns whose values are local ids that must be remapped: sequence-backed
        // columns and FK columns that reference a sequence-backed column.
        boolean[] remap = new boolean[cols.size()];
        for (int i = 0; i < cols.size(); i++) {
            remap[i] = cols.get(i).sequence != null
                    || referencesSequencedColumn(schema, table, cols.get(i).name);
        }
        boolean[] deferred = new boolean[cols.size()];
        for (int i = 0; i < cols.size(); i++) {
            deferred[i] = data.deferredFkColumns.contains(cols.get(i).name);
        }
        int pkIdx = singlePkIndex(table, data);

        boolean overriding = cols.stream().anyMatch(c -> c.identityAlways);
        String sql = "insert into " + Db.quote(table.schema) + "." + Db.quote(table.name) + " ("
                + data.columns.stream().map(Db::quote).collect(Collectors.joining(", "))
                + ")" + (overriding ? " overriding system value" : "") + " values ("
                + data.columns.stream().map(c -> "?").collect(Collectors.joining(", ")) + ")";

        int count = 0;
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            int pending = 0;
            for (List<Object> row : data.rows) {
                for (int i = 0; i < cols.size(); i++) {
                    Object value = row.get(i);
                    if (deferred[i]) {
                        // The referenced table may not be inserted yet; remap when updating.
                        if (value != null) {
                            if (pkIdx < 0) {
                                throw new IllegalStateException("Cannot defer FK column "
                                        + table.name + "." + cols.get(i).name
                                        + ": table has no single-column primary key.");
                            }
                            Object pkValue = remapLocalId(row.get(pkIdx), idMap, table, cols.get(pkIdx));
                            deferredUpdates.add(new DeferredUpdate(table.name, cols.get(i).name, pkValue, value));
                        }
                        value = null;
                    } else if (remap[i]) {
                        value = remapLocalId(value, idMap, table, cols.get(i));
                    }
                    ValueCoercer.bind(ps, i + 1, cols.get(i), value);
                }
                ps.addBatch();
                count++;
                if (++pending >= batchSize) {
                    ps.executeBatch();
                    pending = 0;
                }
            }
            if (pending > 0) {
                ps.executeBatch();
            }
        } catch (SQLException e) {
            throw new SQLException("Insert into " + table.qualifiedName() + " failed: "
                    + rootMessage(e), e);
        }
        return count;
    }

    private static Object remapLocalId(Object value, Map<Long, Long> idMap, TableModel table, ColumnModel col) {
        if (value instanceof Number n && n.longValue() < 0) {
            Long real = idMap.get(n.longValue());
            if (real == null) {
                throw new IllegalStateException("No allocated id for local id " + n
                        + " (" + table.name + "." + col.name + "). Is the data file complete?");
            }
            return real;
        }
        return value;
    }

    static boolean referencesSequencedColumn(SchemaModel schema, TableModel table, String columnName) {
        for (ForeignKeyModel fk : table.foreignKeys) {
            int idx = fk.columns.indexOf(columnName);
            if (idx < 0) {
                continue;
            }
            TableModel parent = schema.table(fk.referencedTable);
            if (parent != null) {
                ColumnModel refCol = parent.column(fk.referencedColumns.get(idx));
                if (refCol != null && refCol.sequence != null) {
                    return true;
                }
            }
        }
        return false;
    }

    private static int singlePkIndex(TableModel table, TableDataModel data) {
        if (table.primaryKey.size() != 1) {
            return -1;
        }
        return data.columns.indexOf(table.primaryKey.get(0));
    }

    private int applyDeferredUpdates(SchemaModel schema, List<DeferredUpdate> updates,
                                     Map<Long, Long> idMap) throws SQLException {
        if (updates.isEmpty()) {
            return 0;
        }
        Map<String, List<DeferredUpdate>> grouped = new LinkedHashMap<>();
        for (DeferredUpdate u : updates) {
            grouped.computeIfAbsent(u.table() + "|" + u.column(), k -> new ArrayList<>()).add(u);
        }
        int total = 0;
        for (List<DeferredUpdate> group : grouped.values()) {
            TableModel table = requireTable(schema, group.get(0).table());
            ColumnModel col = table.column(group.get(0).column());
            ColumnModel pkCol = table.column(table.primaryKey.get(0));
            String sql = "update " + Db.quote(table.schema) + "." + Db.quote(table.name)
                    + " set " + Db.quote(col.name) + " = ? where " + Db.quote(pkCol.name) + " = ?";
            try (PreparedStatement ps = connection.prepareStatement(sql)) {
                int pending = 0;
                for (DeferredUpdate u : group) {
                    Object value = remapLocalId(u.value(), idMap, table, col);
                    ValueCoercer.bind(ps, 1, col, value);
                    ValueCoercer.bind(ps, 2, pkCol, u.pkValue());
                    ps.addBatch();
                    total++;
                    if (++pending >= batchSize) {
                        ps.executeBatch();
                        pending = 0;
                    }
                }
                if (pending > 0) {
                    ps.executeBatch();
                }
            }
            log.accept("  " + table.qualifiedName() + "." + col.name + ": "
                    + group.size() + " deferred FK updates");
        }
        return total;
    }

    private static String rootMessage(SQLException e) {
        Throwable t = e;
        while (t.getCause() != null && t.getCause() != t) {
            t = t.getCause();
        }
        return t.getMessage();
    }
}
