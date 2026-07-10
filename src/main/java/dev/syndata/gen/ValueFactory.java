package dev.syndata.gen;

import dev.syndata.model.ColumnModel;
import dev.syndata.model.TableModel;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * Builds a value producer for a column, in priority order:
 * declared value lists (Postgres enums, CHECK constraints, entity-scanner hints),
 * name heuristics, optional local-model pool for free text, then a type-based fallback.
 */
public final class ValueFactory {

    private ValueFactory() {
    }

    public static Supplier<Object> forColumn(GenContext ctx, TableModel table, ColumnModel col,
                                             int poolSize, Consumer<String> log) {
        List<String> values = firstNonEmpty(col.enumValues, col.checkValues, col.semanticValues);
        if (values != null) {
            List<String> pool = values;
            return () -> coerceToColumn(pool.get(ctx.random.nextInt(pool.size())), col);
        }
        if ("EMAIL".equals(col.semantic)) {
            return fit(col, () -> ctx.faker.internet().emailAddress());
        }

        NameHeuristics.Match match = NameHeuristics.forColumn(ctx, table, col);
        if (match != null && !match.generic()) {
            return fit(col, match.supplier());
        }

        // Free-text columns with no specific rule: try the optional local model pool.
        if (ctx.aiPool != null && NameHeuristics.isTexty(col.typeName.toLowerCase(Locale.ROOT))
                && (col.length == null || col.length >= 8)) {
            List<String> pool = ctx.aiPool.pool(table.name, col.name, col.typeName, col.length, poolSize);
            if (pool != null && !pool.isEmpty()) {
                return fit(col, () -> pool.get(ctx.random.nextInt(pool.size())));
            }
        }
        if (match != null) {
            return fit(col, match.supplier());
        }
        return fallback(ctx, table, col, log);
    }

    private static Supplier<Object> fallback(GenContext ctx, TableModel table, ColumnModel col,
                                             Consumer<String> log) {
        String type = col.typeName.toLowerCase(Locale.ROOT);
        var r = ctx.random;
        switch (type) {
            case "varchar", "text", "bpchar", "char", "name", "citext":
                if (col.length != null && col.length < 8) {
                    return fit(col, () -> ctx.faker.bothify("?".repeat(Math.max(1, col.length)), true));
                }
                return fit(col, () -> String.join(" ", ctx.faker.lorem().words(2 + r.nextInt(3))));
            case "int2", "smallint":
                return () -> (short) r.nextInt(1, 1000);
            case "int4", "integer":
                return () -> r.nextInt(1, 100_000);
            case "int8", "bigint":
                return () -> (long) r.nextInt(1, 1_000_000);
            case "numeric", "decimal": {
                int scale = col.scale == null ? 2 : Math.max(0, col.scale);
                int intDigits = col.precision == null ? 6 : Math.max(1, Math.min(col.precision - scale, 6));
                long max = (long) Math.pow(10, intDigits) - 1;
                return () -> NameHeuristics.decimal(ctx, scale, 1, Math.max(2, Math.min(max, 100_000)));
            }
            case "float4", "real", "float8", "double precision":
                return () -> BigDecimal.valueOf(r.nextDouble() * 1000)
                        .setScale(3, RoundingMode.HALF_UP).doubleValue();
            case "bool", "boolean":
                return r::nextBoolean;
            case "date":
                return () -> LocalDate.now().minusDays(r.nextInt(1095));
            case "timestamp":
                return () -> NameHeuristics.pastTimestamp(ctx, "timestamp", 730);
            case "timestamptz":
                return () -> NameHeuristics.pastTimestamp(ctx, "timestamptz", 730);
            case "time":
                return () -> LocalTime.of(r.nextInt(24), r.nextInt(60), r.nextInt(60));
            case "timetz":
                return () -> OffsetTime.of(r.nextInt(24), r.nextInt(60), r.nextInt(60), 0, ZoneOffset.UTC);
            case "uuid":
                return () -> new UUID(r.nextLong(), r.nextLong());
            case "json", "jsonb":
                return () -> "{\"note\": \"" + ctx.faker.lorem().word() + "\"}";
            case "bytea":
                return () -> {
                    byte[] b = new byte[8];
                    r.nextBytes(b);
                    return b;
                };
            case "interval":
                return () -> (1 + r.nextInt(30)) + " days";
            case "inet":
                return () -> ctx.faker.internet().ipV4Address();
            default:
                log.accept("Warning: no generator for type '" + col.typeName + "' ("
                        + table.name + "." + col.name + "); using "
                        + (col.nullable ? "NULL" : "empty string") + ".");
                return () -> col.nullable ? null : "";
        }
    }

    /** Coerces a picked list value (always stored as string) to the column's Java type. */
    private static Object coerceToColumn(String value, ColumnModel col) {
        String type = col.typeName.toLowerCase(Locale.ROOT);
        try {
            if (NameHeuristics.isIntegerish(type)) {
                return Long.parseLong(value.trim());
            }
            if (NameHeuristics.isDecimal(type)) {
                return new BigDecimal(value.trim());
            }
        } catch (NumberFormatException ignored) {
            // fall through and let the string be sent as-is
        }
        return value;
    }

    /** Truncates string results to the column length. */
    private static Supplier<Object> fit(ColumnModel col, Supplier<Object> inner) {
        if (col.length == null) {
            return inner;
        }
        int max = col.length;
        return () -> {
            Object v = inner.get();
            if (v instanceof String s && s.length() > max) {
                return s.substring(0, max).strip();
            }
            return v;
        };
    }

    @SafeVarargs
    private static List<String> firstNonEmpty(List<String>... lists) {
        for (List<String> l : lists) {
            if (l != null && !l.isEmpty()) {
                return l;
            }
        }
        return null;
    }
}
