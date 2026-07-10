package dev.syndata.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/** A single column of a table, as captured by {@code scan}. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ColumnModel {

    public String name;
    /** Postgres type name, e.g. {@code int8}, {@code varchar}, {@code timestamptz}, or an enum type name. */
    public String typeName;
    /** {@link java.sql.Types} constant. */
    public int jdbcType;
    public boolean nullable;
    /** Character length for text types (null when not applicable or unbounded). */
    public Integer length;
    /** Numeric precision (null when not applicable). */
    public Integer precision;
    /** Numeric scale (null when not applicable). */
    public Integer scale;
    /** Raw column default expression as reported by Postgres, if any. */
    public String defaultValue;
    /** True for identity columns (GENERATED ... AS IDENTITY) and serial columns. */
    public boolean identity;
    /** True only for GENERATED ALWAYS AS IDENTITY (insert needs OVERRIDING SYSTEM VALUE). */
    public boolean identityAlways;
    /** True for generated (computed) columns; these are never generated or inserted. */
    public boolean generated;
    /**
     * Qualified name of the sequence that produces values for this column, if any.
     * Set for serial/identity columns and for numeric PK columns backed by the
     * Hibernate global sequence.
     */
    public String sequence;
    /** Labels of the Postgres enum type, when {@code typeName} is an enum. */
    public List<String> enumValues;
    /** Allowed values extracted from a simple CHECK (col IN (...)) constraint. */
    public List<String> checkValues;
    /** Semantic hint, e.g. EMAIL or ENUM, contributed by the entity scanner. */
    public String semantic;
    /** Allowed values contributed by the entity scanner (e.g. Java enum constants). */
    public List<String> semanticValues;

    public ColumnModel() {
    }

    public ColumnModel(String name, String typeName, int jdbcType, boolean nullable) {
        this.name = name;
        this.typeName = typeName;
        this.jdbcType = jdbcType;
        this.nullable = nullable;
    }
}
