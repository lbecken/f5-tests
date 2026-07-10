package dev.syndata.model;

import java.util.ArrayList;
import java.util.List;

/** A foreign key constraint; columns and referencedColumns are positionally aligned. */
public class ForeignKeyModel {

    public String name;
    public List<String> columns = new ArrayList<>();
    public String referencedSchema;
    public String referencedTable;
    public List<String> referencedColumns = new ArrayList<>();

    public ForeignKeyModel() {
    }

    public ForeignKeyModel(String name, String referencedSchema, String referencedTable) {
        this.name = name;
        this.referencedSchema = referencedSchema;
        this.referencedTable = referencedTable;
    }
}
