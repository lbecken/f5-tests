package dev.syndata.analyze;

import dev.syndata.model.ColumnModel;
import dev.syndata.model.ForeignKeyModel;
import dev.syndata.model.SchemaModel;
import dev.syndata.model.TableModel;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * Orders tables so that every table comes after the tables it references.
 * Self-references are ignored (a row may reference an earlier row of the same
 * table, or itself). Cycles between tables are broken on foreign keys whose
 * columns are all nullable; those FKs are reported as "deferred" and are applied
 * with UPDATE statements after all rows are inserted.
 */
public final class TableGraph {

    /** Result of the sort: insertion order plus FK column names to defer, per table. */
    public record Order(List<TableModel> tables, Map<String, Set<String>> deferredFkColumns,
                        List<String> warnings) {
    }

    private TableGraph() {
    }

    public static Order sort(SchemaModel schema) {
        Map<String, TableModel> byName = new LinkedHashMap<>();
        for (TableModel t : schema.tables) {
            byName.put(t.name, t);
        }

        // dependencies[child] = set of parent tables that must be inserted first
        Map<String, Set<String>> dependencies = new HashMap<>();
        for (TableModel t : schema.tables) {
            Set<String> parents = new TreeSet<>();
            for (ForeignKeyModel fk : t.foreignKeys) {
                if (!fk.referencedTable.equals(t.name) && byName.containsKey(fk.referencedTable)) {
                    parents.add(fk.referencedTable);
                }
            }
            dependencies.put(t.name, parents);
        }

        List<TableModel> order = new ArrayList<>();
        Map<String, Set<String>> deferred = new LinkedHashMap<>();
        List<String> warnings = new ArrayList<>();
        Set<String> placed = new HashSet<>();
        Set<String> remaining = new TreeSet<>(byName.keySet());

        while (!remaining.isEmpty()) {
            List<String> ready = new ArrayList<>();
            for (String name : remaining) {
                if (placed.containsAll(dependencies.get(name))) {
                    ready.add(name);
                }
            }
            if (!ready.isEmpty()) {
                for (String name : ready) {
                    order.add(byName.get(name));
                    placed.add(name);
                    remaining.remove(name);
                }
                continue;
            }
            // Cycle: break one edge, preferring an FK with all-nullable columns.
            if (!breakCycleEdge(byName, dependencies, remaining, placed, deferred, warnings)) {
                // Should not happen, but never loop forever.
                String name = remaining.iterator().next();
                warnings.add("Could not order table " + name + "; inserting it anyway.");
                order.add(byName.get(name));
                placed.add(name);
                remaining.remove(name);
            }
        }
        return new Order(order, deferred, warnings);
    }

    private static boolean breakCycleEdge(Map<String, TableModel> byName,
                                          Map<String, Set<String>> dependencies,
                                          Set<String> remaining, Set<String> placed,
                                          Map<String, Set<String>> deferred, List<String> warnings) {
        // Only consider tables that are actually part of a cycle among the remaining set.
        Set<String> cyclic = cyclicTables(dependencies, remaining, placed);
        // First pass: an FK whose columns are all nullable.
        for (boolean requireNullable : new boolean[]{true, false}) {
            for (String name : cyclic) {
                TableModel t = byName.get(name);
                Set<String> alreadyDeferred = deferred.getOrDefault(name, Set.of());
                for (ForeignKeyModel fk : t.foreignKeys) {
                    if (fk.referencedTable.equals(name) || !cyclic.contains(fk.referencedTable)
                            || alreadyDeferred.containsAll(fk.columns)) {
                        continue;
                    }
                    if (requireNullable && !allNullable(t, fk)) {
                        continue;
                    }
                    dependencies.get(name).remove(fk.referencedTable);
                    // Re-add if another non-deferred FK also points to the same parent.
                    for (ForeignKeyModel other : t.foreignKeys) {
                        if (other != fk && other.referencedTable.equals(fk.referencedTable)
                                && !alreadyDeferred.containsAll(other.columns)) {
                            dependencies.get(name).add(fk.referencedTable);
                        }
                    }
                    deferred.computeIfAbsent(name, k -> new LinkedHashSet<>()).addAll(fk.columns);
                    if (!requireNullable) {
                        warnings.add("Cycle between " + name + " and " + fk.referencedTable
                                + " broken on NOT NULL FK " + fk.name
                                + "; inserts will fail unless the constraint is DEFERRABLE.");
                    }
                    return true;
                }
            }
        }
        return false;
    }

    /** Tables among {@code remaining} that can reach themselves through unresolved dependencies. */
    private static Set<String> cyclicTables(Map<String, Set<String>> dependencies,
                                            Set<String> remaining, Set<String> placed) {
        Set<String> cyclic = new LinkedHashSet<>();
        for (String start : remaining) {
            Deque<String> stack = new ArrayDeque<>();
            Set<String> seen = new HashSet<>();
            for (String dep : dependencies.get(start)) {
                if (!placed.contains(dep)) {
                    stack.push(dep);
                }
            }
            while (!stack.isEmpty()) {
                String cur = stack.pop();
                if (cur.equals(start)) {
                    cyclic.add(start);
                    break;
                }
                if (!seen.add(cur) || placed.contains(cur)) {
                    continue;
                }
                for (String dep : dependencies.getOrDefault(cur, Set.of())) {
                    if (!placed.contains(dep)) {
                        stack.push(dep);
                    }
                }
            }
        }
        return cyclic.isEmpty() ? new LinkedHashSet<>(remaining) : cyclic;
    }

    private static boolean allNullable(TableModel t, ForeignKeyModel fk) {
        for (String col : fk.columns) {
            ColumnModel c = t.column(col);
            if (c == null || !c.nullable) {
                return false;
            }
        }
        return true;
    }
}
