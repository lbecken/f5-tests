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
