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

    private CheckParser() {
    }

    /** Fills {@code check.column} and {@code check.values} when the expression is a simple value list. */
    public static void parse(CheckModel check) {
        if (check.expression == null) {
            return;
        }
        Matcher m = ANY_ARRAY.matcher(check.expression);
        if (!m.find()) {
            m = IN_LIST.matcher(check.expression);
            if (!m.find()) {
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
}
