package dev.syndata.analyze;

import dev.syndata.model.CheckModel;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extracts a column name and its allowed values from simple CHECK constraints.
 * Postgres normalizes {@code col IN ('A','B')} into
 * {@code CHECK (((col)::text = ANY ((ARRAY['A'::character varying, 'B'::character varying])::text[])))},
 * so both spellings are handled.
 */
public final class CheckParser {

    // ((status)::text = ANY (ARRAY['A'::text, 'B'::text]))  and variants with extra casts
    private static final Pattern ANY_ARRAY = Pattern.compile(
            "\\(*\\s*\"?(\\w+)\"?\\s*\\)*(?:::\\w[\\w ]*)?\\s*=\\s*ANY\\s*\\(+\\s*ARRAY\\s*\\[(.*?)]",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    // col IN ('A', 'B')
    private static final Pattern IN_LIST = Pattern.compile(
            "\\(*\\s*\"?(\\w+)\"?\\s*\\)*(?:::\\w[\\w ]*)?\\s+IN\\s*\\((.*?)\\)",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private static final Pattern QUOTED_VALUE = Pattern.compile("'((?:[^']|'')*)'");

    // price >= (0)::numeric  /  quantity > 0  /  "pct" <= 100.5
    // The lookbehind rejects function arguments such as length(name) > 3.
    private static final Pattern COMPARISON = Pattern.compile(
            "(?<!\\w)(?<!\\w\\()\"?(\\w+)\"?\\s*\\)*(?:::[\\w ]+)?\\s*(>=|<=|>|<)\\s*\\(*'?(-?\\d+(?:\\.\\d+)?)'?\\)*");

    private CheckParser() {
    }

    /**
     * Fills {@code check.column} plus {@code check.values} (simple value lists) or
     * {@code check.min}/{@code check.max} (simple numeric ranges).
     */
    public static void parse(CheckModel check) {
        if (check.expression == null) {
            return;
        }
        Matcher m = ANY_ARRAY.matcher(check.expression);
        if (!m.find()) {
            m = IN_LIST.matcher(check.expression);
            if (!m.find()) {
                parseRange(check);
                return;
            }
        }
        List<String> values = new ArrayList<>();
        Matcher v = QUOTED_VALUE.matcher(m.group(2));
        while (v.find()) {
            values.add(v.group(1).replace("''", "'"));
        }
        if (!values.isEmpty()) {
            check.column = m.group(1);
            check.values = values;
        }
    }

    /** Extracts min/max bounds from comparisons that all target one column, ANDed together. */
    private static void parseRange(CheckModel check) {
        if (check.expression.toUpperCase(java.util.Locale.ROOT).contains(" OR ")) {
            return; // e.g. (a < 0 OR a > 10): bounds would be wrong
        }
        String column = null;
        java.math.BigDecimal min = null;
        java.math.BigDecimal max = null;
        boolean minExclusive = false;
        boolean maxExclusive = false;
        Matcher m = COMPARISON.matcher(check.expression);
        while (m.find()) {
            if (column == null) {
                column = m.group(1);
            } else if (!column.equals(m.group(1))) {
                return; // comparisons over several columns: too complex
            }
            java.math.BigDecimal value = new java.math.BigDecimal(m.group(3));
            switch (m.group(2)) {
                case ">=" -> min = value;
                case ">" -> {
                    min = value;
                    minExclusive = true;
                }
                case "<=" -> max = value;
                case "<" -> {
                    max = value;
                    maxExclusive = true;
                }
                default -> {
                }
            }
        }
        if (column == null || (min == null && max == null)) {
            return;
        }
        check.column = column;
        check.min = min;
        check.max = max;
        check.minExclusive = min != null && minExclusive ? true : null;
        check.maxExclusive = max != null && maxExclusive ? true : null;
    }
}
