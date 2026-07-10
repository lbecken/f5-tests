package dev.syndata.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/** A CHECK constraint. When it is a simple {@code col IN (...)}, column/values are filled. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CheckModel {

    public String name;
    /** Raw expression from pg_get_constraintdef. */
    public String expression;
    /** Column the constraint applies to, when it could be parsed. */
    public String column;
    /** Allowed values, when the constraint is a simple IN / = ANY list. */
    public List<String> values;

    public CheckModel() {
    }

    public CheckModel(String name, String expression) {
        this.name = name;
        this.expression = expression;
    }
}
