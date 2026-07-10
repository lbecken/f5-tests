package dev.syndata.model;

import com.fasterxml.jackson.annotation.JsonIgnore;

import java.util.ArrayList;
import java.util.List;

/** Root of the exported schema file. */
public class SchemaModel {

    public int version = 1;
    public String generatedAt;
    public String databaseProduct;
    public String schemaName;
    /** Qualified name of the Hibernate global sequence, when found (e.g. public.hibernate_sequence). */
    public String globalSequence;
    /** All sequences found in the schema, qualified. */
    public List<String> sequences = new ArrayList<>();
    public List<TableModel> tables = new ArrayList<>();

    @JsonIgnore
    public TableModel table(String name) {
        for (TableModel t : tables) {
            if (t.name.equals(name)) {
                return t;
            }
        }
        return null;
    }
}
