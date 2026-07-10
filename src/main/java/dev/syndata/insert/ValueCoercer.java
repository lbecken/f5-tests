package dev.syndata.insert;

import dev.syndata.model.ColumnModel;

import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Types;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.OffsetTime;
import java.util.Base64;
import java.util.Locale;
import java.util.UUID;

/**
 * Binds a JSON-deserialized value to a PreparedStatement parameter using the
 * column type from the schema file (dates arrive as ISO strings, bytea as base64, ...).
 */
public final class ValueCoercer {

    private ValueCoercer() {
    }

    public static void bind(PreparedStatement ps, int index, ColumnModel col, Object value)
            throws SQLException {
        if (value == null) {
            ps.setNull(index, col.jdbcType == 0 ? Types.NULL : col.jdbcType);
            return;
        }
        String type = col.typeName.toLowerCase(Locale.ROOT);
        if (value instanceof Number n) {
            switch (type) {
                case "int2", "smallint" -> ps.setShort(index, n.shortValue());
                case "int4", "integer" -> ps.setInt(index, n.intValue());
                case "int8", "bigint" -> ps.setLong(index, n.longValue());
                case "numeric", "decimal", "money" -> ps.setBigDecimal(index, new BigDecimal(n.toString()));
                case "float4", "real" -> ps.setFloat(index, n.floatValue());
                case "float8", "double precision" -> ps.setDouble(index, n.doubleValue());
                default -> ps.setObject(index, n);
            }
            return;
        }
        if (value instanceof Boolean b) {
            ps.setBoolean(index, b);
            return;
        }
        String s = value.toString();
        switch (type) {
            case "date" -> ps.setObject(index, LocalDate.parse(s));
            case "timestamp" -> ps.setObject(index, LocalDateTime.parse(s));
            case "timestamptz" -> ps.setObject(index, OffsetDateTime.parse(s));
            case "time" -> ps.setObject(index, LocalTime.parse(s));
            case "timetz" -> ps.setObject(index, OffsetTime.parse(s));
            case "uuid" -> ps.setObject(index, UUID.fromString(s));
            case "bytea" -> ps.setBytes(index, Base64.getDecoder().decode(s));
            case "varchar", "text", "bpchar", "char", "name", "citext" -> ps.setString(index, s);
            case "int2", "smallint" -> ps.setShort(index, Short.parseShort(s));
            case "int4", "integer" -> ps.setInt(index, Integer.parseInt(s));
            case "int8", "bigint" -> ps.setLong(index, Long.parseLong(s));
            case "numeric", "decimal" -> ps.setBigDecimal(index, new BigDecimal(s));
            case "bool", "boolean" -> ps.setBoolean(index, Boolean.parseBoolean(s));
            // enums, json/jsonb, interval, inet, and other Postgres-specific types
            default -> ps.setObject(index, s, Types.OTHER);
        }
    }
}
