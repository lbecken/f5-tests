package dev.syndata.model;

import java.util.ArrayList;
import java.util.List;

/** Generated rows for one table. Row values are positionally aligned with {@link #columns}. */
public class TableDataModel {

    public String schema;
    public String name;
    public List<String> columns = new ArrayList<>();
    /**
     * FK columns that must be inserted as NULL first and applied with UPDATEs after
     * all tables are loaded, because they are part of a dependency cycle.
     */
    public List<String> deferredFkColumns = new ArrayList<>();
    /**
     * Row values. Sequence-backed PK values (and FK references to them) are stored as
     * negative "local ids" and remapped to real sequence values at insert time.
     */
    public List<List<Object>> rows = new ArrayList<>();

    public TableDataModel() {
    }

    public TableDataModel(String schema, String name) {
        this.schema = schema;
        this.name = name;
    }
}
