package dev.syndata.gen;

import dev.syndata.analyze.TableGraph;
import dev.syndata.model.ColumnModel;
import dev.syndata.model.DataSetModel;
import dev.syndata.model.ForeignKeyModel;
import dev.syndata.model.SchemaModel;
import dev.syndata.model.TableDataModel;
import dev.syndata.model.TableModel;
import dev.syndata.model.UniqueModel;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * Produces an FK-consistent {@link DataSetModel} from a {@link SchemaModel}.
 * Tables are generated in dependency order; sequence-backed primary keys get
 * negative "local ids" that the inserter later swaps for real sequence values.
 */
public class DataGenerator {

    private static final int MAX_ROW_ATTEMPTS = 30;

    public record Options(int defaultRows, Map<String, Integer> tableRows, long seed,
                          double nullRatio, java.util.Locale locale, dev.syndata.ai.AiValuePool aiPool) {
    }

    private final Consumer<String> log;

    public DataGenerator(Consumer<String> log) {
        this.log = log;
    }

    /** Rows of one generated table, kept around so children can reference them. */
    private static final class Generated {
        final TableModel table;
        final List<String> columnNames = new ArrayList<>();
        final Map<String, Integer> index = new HashMap<>();
        final List<Object[]> rows = new ArrayList<>();

        Generated(TableModel table) {
            this.table = table;
            for (ColumnModel c : table.columns) {
                if (!c.generated) {
                    index.put(c.name, columnNames.size());
                    columnNames.add(c.name);
                }
            }
        }
    }

    public DataSetModel generate(SchemaModel schema, Options opts) {
        TableGraph.Order order = TableGraph.sort(schema);
        order.warnings().forEach(log);
        seenUniqueKeys.clear();

        GenContext ctx = new GenContext(opts.seed(), opts.locale(), opts.aiPool());
        Map<String, Generated> generated = new LinkedHashMap<>();
        long[] localId = {-1};

        for (TableModel table : order.tables()) {
            Set<String> deferredCols = order.deferredFkColumns().getOrDefault(table.name, Set.of());
            int rows = opts.tableRows().getOrDefault(table.name, opts.defaultRows());
            Generated g = generateTable(schema, table, rows, deferredCols, generated, ctx, opts, localId);
            generated.put(table.name, g);
        }

        fillDeferredColumns(order, generated, ctx, opts);

        DataSetModel data = new DataSetModel();
        data.generatedAt = OffsetDateTime.now().truncatedTo(ChronoUnit.SECONDS).toString();
        data.seed = opts.seed();
        for (Generated g : generated.values()) {
            TableDataModel t = new TableDataModel(g.table.schema, g.table.name);
            t.columns = g.columnNames;
            t.deferredFkColumns = new ArrayList<>(
                    order.deferredFkColumns().getOrDefault(g.table.name, Set.of()));
            for (Object[] row : g.rows) {
                t.rows.add(Arrays.asList(row));
            }
            data.tables.add(t);
        }
        return data;
    }

    private Generated generateTable(SchemaModel schema, TableModel table, int rowCount,
                                    Set<String> deferredCols, Map<String, Generated> generated,
                                    GenContext ctx, Options opts, long[] localId) {
        Generated g = new Generated(table);

        // Columns produced by a sequence carry local ids.
        Set<String> seqCols = new HashSet<>();
        for (ColumnModel c : table.columns) {
            if (c.sequence != null) {
                seqCols.add(c.name);
            }
        }
        // Columns covered by FKs are copied from parent rows, not generated.
        Set<String> fkCols = new HashSet<>();
        for (ForeignKeyModel fk : table.foreignKeys) {
            fkCols.addAll(fk.columns);
        }

        Map<String, Supplier<Object>> suppliers = new HashMap<>();
        for (ColumnModel c : table.columns) {
            if (!c.generated && !seqCols.contains(c.name) && !fkCols.contains(c.name)) {
                suppliers.put(c.name, ValueFactory.forColumn(ctx, table, c,
                        Math.min(60, Math.max(rowCount, 15)), log));
            }
        }

        List<UniqueModel> uniques = collectUniqueSets(table, deferredCols, seqCols);

        for (int i = 0; i < rowCount; i++) {
            Object[] accepted = null;
            for (int attempt = 0; attempt < MAX_ROW_ATTEMPTS; attempt++) {
                Object[] row = buildRow(schema, table, g, seqCols, fkCols, deferredCols,
                        suppliers, generated, ctx, opts, localId);
                if (row == null) {
                    break; // unresolvable FK; skip the table with whatever we have
                }
                if (!claimUniqueKeys(uniques, g, row)) {
                    continue; // duplicate; retry with fresh values
                }
                accepted = row;
                break;
            }
            if (accepted == null) {
                if (i > 0) {
                    log.accept("Note: " + table.name + ": stopped at " + i + " of " + rowCount
                            + " rows (unique combinations exhausted).");
                } else {
                    log.accept("Warning: could not generate rows for " + table.name
                            + " (unresolvable references or unique constraints).");
                }
                break;
            }
            g.rows.add(accepted);
        }
        return g;
    }

    private Object[] buildRow(SchemaModel schema, TableModel table, Generated g,
                              Set<String> seqCols, Set<String> fkCols, Set<String> deferredCols,
                              Map<String, Supplier<Object>> suppliers, Map<String, Generated> generated,
                              GenContext ctx, Options opts, long[] localId) {
        Object[] row = new Object[g.columnNames.size()];
        Set<String> assigned = new HashSet<>();

        for (String col : seqCols) {
            Integer idx = g.index.get(col);
            if (idx != null) {
                row[idx] = localId[0]--;
                assigned.add(col);
            }
        }

        for (ForeignKeyModel fk : table.foreignKeys) {
            if (deferredCols.containsAll(fk.columns)) {
                fk.columns.forEach(assigned::add); // left null; filled in the deferred pass
                continue;
            }
            boolean selfRef = fk.referencedTable.equals(table.name);
            Generated parent = selfRef ? g : generated.get(fk.referencedTable);
            boolean nullable = fk.columns.stream()
                    .allMatch(c -> table.column(c) != null && table.column(c).nullable);

            List<Object[]> pool = parent == null ? List.of() : parent.rows;
            if (pool.isEmpty()) {
                if (nullable) {
                    fk.columns.forEach(assigned::add);
                    continue;
                }
                if (selfRef && fk.referencedColumns.size() == 1
                        && seqCols.contains(fk.referencedColumns.get(0))) {
                    // First row of a NOT NULL self-reference points at itself.
                    Integer selfIdx = g.index.get(fk.columns.get(0));
                    row[selfIdx] = row[g.index.get(fk.referencedColumns.get(0))];
                    assigned.add(fk.columns.get(0));
                    continue;
                }
                log.accept("Warning: " + table.name + "." + fk.name + " references "
                        + fk.referencedTable + " which has no rows; cannot satisfy NOT NULL FK.");
                return null;
            }
            if (nullable && ctx.random.nextDouble() < 0.10) {
                fk.columns.forEach(assigned::add);
                continue;
            }
            Object[] parentRow = pool.get(ctx.random.nextInt(pool.size()));
            for (int k = 0; k < fk.columns.size(); k++) {
                Integer idx = g.index.get(fk.columns.get(k));
                Integer parentIdx = parent.index.get(fk.referencedColumns.get(k));
                if (idx != null && parentIdx != null) {
                    row[idx] = parentRow[parentIdx];
                }
                assigned.add(fk.columns.get(k));
            }
        }

        for (ColumnModel c : table.columns) {
            if (c.generated || assigned.contains(c.name)) {
                continue;
            }
            int idx = g.index.get(c.name);
            if (c.nullable && ctx.random.nextDouble() < opts.nullRatio()) {
                row[idx] = null;
            } else {
                row[idx] = suppliers.get(c.name).get();
            }
        }
        return row;
    }

    /** PK plus unique constraints, expressed over data-file columns; used to reject duplicate rows. */
    private List<UniqueModel> collectUniqueSets(TableModel table, Set<String> deferredCols,
                                                Set<String> seqCols) {
        List<UniqueModel> sets = new ArrayList<>();
        if (!table.primaryKey.isEmpty() && !table.primaryKey.stream().allMatch(seqCols::contains)) {
            sets.add(new UniqueModel("(pk)", table.primaryKey));
        }
        for (UniqueModel u : table.uniqueConstraints) {
            boolean usable = u.columns.stream().noneMatch(deferredCols::contains)
                    && u.columns.stream().noneMatch(seqCols::contains);
            if (usable) {
                sets.add(u);
            }
        }
        return sets;
    }

    private final Set<String> seenUniqueKeys = new HashSet<>();

    /**
     * Claims the unique-set keys of this row; returns false if any was already used.
     * Rows containing NULL in a unique set are exempt, as in SQL.
     */
    private boolean claimUniqueKeys(List<UniqueModel> uniques, Generated g, Object[] row) {
        List<String> keys = new ArrayList<>();
        for (UniqueModel u : uniques) {
            StringBuilder key = new StringBuilder(g.table.name).append('|').append(u.name);
            boolean hasNull = false;
            for (String col : u.columns) {
                Integer idx = g.index.get(col);
                Object v = idx == null ? null : row[idx];
                if (v == null) {
                    hasNull = true;
                    break;
                }
                key.append('|').append(v);
            }
            if (!hasNull) {
                keys.add(key.toString());
            }
        }
        for (String key : keys) {
            if (seenUniqueKeys.contains(key)) {
                return false;
            }
        }
        seenUniqueKeys.addAll(keys);
        return true;
    }

    /** Second pass: fill FK columns that were deferred to break dependency cycles. */
    private void fillDeferredColumns(TableGraph.Order order, Map<String, Generated> generated,
                                     GenContext ctx, Options opts) {
        for (Map.Entry<String, Set<String>> e : order.deferredFkColumns().entrySet()) {
            Generated g = generated.get(e.getKey());
            if (g == null) {
                continue;
            }
            for (ForeignKeyModel fk : g.table.foreignKeys) {
                if (!e.getValue().containsAll(fk.columns)) {
                    continue;
                }
                Generated parent = generated.get(fk.referencedTable);
                if (parent == null || parent.rows.isEmpty()) {
                    continue;
                }
                boolean nullable = fk.columns.stream()
                        .allMatch(c -> g.table.column(c) != null && g.table.column(c).nullable);
                for (Object[] row : g.rows) {
                    if (nullable && ctx.random.nextDouble() < 0.15) {
                        continue;
                    }
                    Object[] parentRow = parent.rows.get(ctx.random.nextInt(parent.rows.size()));
                    for (int k = 0; k < fk.columns.size(); k++) {
                        Integer idx = g.index.get(fk.columns.get(k));
                        Integer parentIdx = parent.index.get(fk.referencedColumns.get(k));
                        if (idx != null && parentIdx != null) {
                            row[idx] = parentRow[parentIdx];
                        }
                    }
                }
            }
        }
    }
}
