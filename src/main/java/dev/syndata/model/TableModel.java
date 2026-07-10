package dev.syndata.model;

import com.fasterxml.jackson.annotation.JsonIgnore;

import java.util.ArrayList;
import java.util.List;

/** A table with its columns and constraints. */
public class TableModel {

    public String schema;
    public String name;
    /**
     * True when the table looks like a pure association (join) table:
     * every column belongs to a foreign key and there are at least two FKs.
     */
    public boolean joinTable;
    /**
     * True for key-only stub tables added by {@code scan --capture-keys} for FK
     * targets outside the selection: no rows are generated or inserted for them,
     * they only lend their existing keys to foreign keys.
     */
    public boolean existingOnly;
    /**
     * Sampled existing primary key values (one inner list per row, aligned with
     * {@link #primaryKey}), captured with {@code scan --capture-keys}. Generated
     * foreign keys fall back to these when a parent table has no generated rows.
     */
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public List<List<Object>> existingKeys;
    public List<ColumnModel> columns = new ArrayList<>();
    public List<String> primaryKey = new ArrayList<>();
    public List<ForeignKeyModel> foreignKeys = new ArrayList<>();
    public List<UniqueModel> uniqueConstraints = new ArrayList<>();
    public List<CheckModel> checkConstraints = new ArrayList<>();

    public TableModel() {
    }

    public TableModel(String schema, String name) {
        this.schema = schema;
        this.name = name;
    }

    @JsonIgnore
    public ColumnModel column(String name) {
        for (ColumnModel c : columns) {
            if (c.name.equals(name)) {
                return c;
            }
        }
        return null;
    }

    @JsonIgnore
    public String qualifiedName() {
        return schema + "." + name;
    }
}
