package dev.syndata.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.util.List;

/**
 * A CHECK constraint. When it is a simple {@code col IN (...)}, column/values are
 * filled; when it is a simple numeric range ({@code col >= 0}, {@code col <= 100},
 * BETWEEN, or both combined with AND), min/max are filled.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CheckModel {

    public String name;
    /** Raw expression from pg_get_constraintdef. */
    public String expression;
    /** Column the constraint applies to, when it could be parsed. */
    public String column;
    /** Allowed values, when the constraint is a simple IN / = ANY list. */
    public List<String> values;
    /** Lower bound, when the constraint is a simple numeric range. */
    public BigDecimal min;
    /** Upper bound, when the constraint is a simple numeric range. */
    public BigDecimal max;
    /** True when the bound came from {@code >} rather than {@code >=}. */
    public Boolean minExclusive;
    /** True when the bound came from {@code <} rather than {@code <=}. */
    public Boolean maxExclusive;

    public CheckModel() {
    }

    public CheckModel(String name, String expression) {
        this.name = name;
        this.expression = expression;
    }
}
