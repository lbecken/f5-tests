package dev.syndata.analyze;

import dev.syndata.model.CheckModel;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class CheckParserTest {

    @Test
    void parsesPostgresNormalizedInList() {
        // This is how Postgres reports "status in ('ACTIVE','INACTIVE','BLOCKED')"
        CheckModel check = new CheckModel("c1",
                "CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, "
                        + "'INACTIVE'::character varying, 'BLOCKED'::character varying])::text[])))");
        CheckParser.parse(check);
        assertEquals("status", check.column);
        assertEquals(List.of("ACTIVE", "INACTIVE", "BLOCKED"), check.values);
    }

    @Test
    void parsesPlainInList() {
        CheckModel check = new CheckModel("c2", "CHECK (method IN ('CARD', 'PAYPAL'))");
        CheckParser.parse(check);
        assertEquals("method", check.column);
        assertEquals(List.of("CARD", "PAYPAL"), check.values);
    }

    @Test
    void parsesAnyArrayOfTextWithoutColumnCast() {
        CheckModel check = new CheckModel("c3",
                "CHECK (kind = ANY (ARRAY['a'::text, 'b'::text]))");
        CheckParser.parse(check);
        assertEquals("kind", check.column);
        assertEquals(List.of("a", "b"), check.values);
    }

    @Test
    void handlesEscapedQuotes() {
        CheckModel check = new CheckModel("c4", "CHECK (label IN ('it''s', 'plain'))");
        CheckParser.parse(check);
        assertEquals(List.of("it's", "plain"), check.values);
    }

    @Test
    void parsesLowerBound() {
        CheckModel check = new CheckModel("c5", "CHECK ((price >= (0)::numeric))");
        CheckParser.parse(check);
        assertEquals("price", check.column);
        assertEquals(new BigDecimal("0"), check.min);
        assertNull(check.minExclusive);
        assertNull(check.max);
    }

    @Test
    void parsesExclusiveBound() {
        CheckModel check = new CheckModel("c6", "CHECK ((quantity > 0))");
        CheckParser.parse(check);
        assertEquals("quantity", check.column);
        assertEquals(new BigDecimal("0"), check.min);
        assertEquals(Boolean.TRUE, check.minExclusive);
    }

    @Test
    void parsesTwoSidedRange() {
        // how Postgres reports "rating >= 0 and rating <= 5" (and BETWEEN)
        CheckModel check = new CheckModel("c7",
                "CHECK (((rating >= (0)::numeric) AND (rating <= (5)::numeric)))");
        CheckParser.parse(check);
        assertEquals("rating", check.column);
        assertEquals(new BigDecimal("0"), check.min);
        assertEquals(new BigDecimal("5"), check.max);
        assertNull(check.minExclusive);
        assertNull(check.maxExclusive);
    }

    @Test
    void skipsOrExpressions() {
        CheckModel check = new CheckModel("c8", "CHECK (((a < 0) OR (a > 10)))");
        CheckParser.parse(check);
        assertNull(check.min);
        assertNull(check.max);
    }

    @Test
    void skipsMultiColumnComparisons() {
        CheckModel check = new CheckModel("c9", "CHECK (((start_n >= 0) AND (end_n <= 10)))");
        CheckParser.parse(check);
        assertNull(check.min);
        assertNull(check.max);
    }

    @Test
    void skipsFunctionCalls() {
        CheckModel check = new CheckModel("c10", "CHECK ((length(name) > 3))");
        CheckParser.parse(check);
        assertNull(check.column);
    }
}
