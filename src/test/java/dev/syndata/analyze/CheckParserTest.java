package dev.syndata.analyze;

import dev.syndata.model.CheckModel;
import org.junit.jupiter.api.Test;

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
    void leavesComplexExpressionsAlone() {
        CheckModel check = new CheckModel("c5", "CHECK ((price >= (0)::numeric))");
        CheckParser.parse(check);
        assertNull(check.column);
        assertNull(check.values);
    }
}
