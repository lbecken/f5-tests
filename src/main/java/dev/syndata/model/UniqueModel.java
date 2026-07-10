package dev.syndata.model;

import java.util.ArrayList;
import java.util.List;

/** A unique constraint or unique index. */
public class UniqueModel {

    public String name;
    public List<String> columns = new ArrayList<>();

    public UniqueModel() {
    }

    public UniqueModel(String name, List<String> columns) {
        this.name = name;
        this.columns = columns;
    }
}
