package dev.syndata.gen;

import dev.syndata.model.ColumnModel;
import dev.syndata.model.TableModel;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.function.Supplier;
import java.util.regex.Pattern;

/**
 * Maps column names such as {@code first_name}, {@code email} or {@code unit_price}
 * to realistic value producers backed by DataFaker.
 */
public final class NameHeuristics {

    /** A matched producer; {@code generic} marks lorem-style text that an AI pool may improve on. */
    public record Match(Supplier<Object> supplier, boolean generic) {
    }

    private static final Pattern PERSON_TABLE =
            Pattern.compile(".*(user|person|people|customer|employee|contact|member|student|patient|author).*");

    private NameHeuristics() {
    }

    public static Match forColumn(GenContext ctx, TableModel table, ColumnModel col) {
        String name = col.name.toLowerCase(Locale.ROOT);
        String type = col.typeName.toLowerCase(Locale.ROOT);
        boolean texty = isTexty(type);
        var f = ctx.faker;
        var r = ctx.random;

        if (texty) {
            if (name.matches("(first|given)_?name")) {
                return plain(() -> f.name().firstName());
            }
            if (name.matches("(last|sur|family)_?name")) {
                return plain(() -> f.name().lastName());
            }
            if (name.matches("(full_?name|name)") && PERSON_TABLE.matcher(table.name.toLowerCase(Locale.ROOT)).matches()) {
                return plain(() -> f.name().fullName());
            }
            if (name.matches(".*e_?mail.*")) {
                return plain(() -> f.internet().emailAddress());
            }
            if (name.matches(".*(phone|mobile|fax).*")) {
                return plain(() -> f.phoneNumber().cellPhone());
            }
            if (name.matches(".*(street|address_line\\d*|address)$") || name.matches("(street|address).*")) {
                return plain(() -> f.address().streetAddress());
            }
            if (name.matches(".*city.*")) {
                return plain(() -> f.address().city());
            }
            if (name.matches(".*(state|province|region).*")) {
                return plain(() -> f.address().state());
            }
            if (name.matches(".*country_?code.*") || (name.matches(".*country.*") && col.length != null && col.length <= 3)) {
                return plain(() -> f.address().countryCode());
            }
            if (name.matches(".*country.*")) {
                return plain(() -> f.address().country());
            }
            if (name.matches(".*(zip|postal).*")) {
                return plain(() -> f.address().zipCode());
            }
            if (name.matches(".*(company|employer|organi[sz]ation|vendor|supplier).*")) {
                return plain(() -> f.company().name());
            }
            if (name.matches("(user_?name|login|nick_?name)")) {
                return plain(() -> (f.name().firstName() + "." + f.name().lastName() + r.nextInt(100))
                        .toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9.]", ""));
            }
            if (name.matches(".*password.*")) {
                return plain(() -> f.internet().password(10, 16));
            }
            if (name.matches(".*(url|website|link|homepage).*")) {
                return plain(() -> f.internet().url());
            }
            if (name.matches(".*(uuid|guid).*")) {
                return plain(() -> new java.util.UUID(r.nextLong(), r.nextLong()).toString());
            }
            if (name.matches(".*(iban).*")) {
                return plain(() -> f.finance().iban());
            }
            if (name.matches(".*(currency).*")) {
                return plain(() -> f.money().currencyCode());
            }
            if (name.matches(".*(color|colour).*")) {
                return plain(() -> f.color().name());
            }
            if (name.matches(".*(ip_?address|ipv4).*")) {
                return plain(() -> f.internet().ipV4Address());
            }
            if (name.matches(".*(sku|barcode|ean|serial|reference|ref_?code|code)$")) {
                return plain(() -> f.bothify("??-######", true));
            }
            if (name.matches(".*(job|position|role|title)$") && PERSON_TABLE.matcher(table.name.toLowerCase(Locale.ROOT)).matches()) {
                return plain(() -> f.job().title());
            }
            if (name.matches(".*(description|summary|notes?|comments?|bio|details|remarks?|body|content|message|text)$")) {
                return new Match(() -> f.lorem().sentence(8 + r.nextInt(10)), true);
            }
            if (name.matches(".*(title|subject|headline)$")) {
                return new Match(() -> capitalize(String.join(" ", f.lorem().words(3 + r.nextInt(3)))), true);
            }
            if (name.matches("(name|label)$") || name.endsWith("_name")) {
                return new Match(() -> f.commerce().productName(), true);
            }
            if (name.matches(".*(gender|sex)$")) {
                return plain(() -> List.of("male", "female", "other").get(r.nextInt(3)));
            }
        }

        if (isIntegerish(type) || isDecimal(type)) {
            if (name.matches(".*(price|cost|amount|total|salary|fee|balance|revenue|budget).*")) {
                return plain(() -> decimal(ctx, 2, 1, 5000));
            }
            if (name.matches(".*(quantity|qty|stock|count|units)$") || name.matches("num_.*")) {
                return plain(() -> r.nextInt(1, 500));
            }
            if (name.matches(".*(percent|percentage|rate|ratio|discount)$")) {
                return plain(() -> decimal(ctx, 2, 0, 100));
            }
            if (name.matches(".*age$")) {
                return plain(() -> r.nextInt(18, 90));
            }
            if (name.matches(".*year$")) {
                return plain(() -> r.nextInt(1980, LocalDate.now().getYear() + 1));
            }
            if (name.matches(".*(weight|height|width|length|depth|distance).*") && isDecimal(type)) {
                return plain(() -> decimal(ctx, 3, 0, 200));
            }
            if (name.matches(".*(lat|latitude)$")) {
                return plain(() -> decimal(ctx, 6, -90, 90));
            }
            if (name.matches(".*(lon|lng|longitude)$")) {
                return plain(() -> decimal(ctx, 6, -180, 180));
            }
        }

        if (isDateType(type) && name.matches(".*(birth|dob).*")) {
            return plain(() -> LocalDate.now().minusYears(18 + r.nextInt(60)).minusDays(r.nextInt(365)));
        }
        if (name.matches("(created|updated|modified|inserted|registered).*") && isTimestampType(type)) {
            return plain(() -> pastTimestamp(ctx, type, 730));
        }
        if (name.matches(".*(expires?|expiry|valid_until|due).*")) {
            if (isDateType(type)) {
                return plain(() -> LocalDate.now().plusDays(r.nextInt(1, 365)));
            }
            if (isTimestampType(type)) {
                return plain(() -> futureTimestamp(ctx, type, 365));
            }
        }
        return null;
    }

    static Object pastTimestamp(GenContext ctx, String type, int maxDaysBack) {
        long seconds = ctx.random.nextLong((long) maxDaysBack * 24 * 3600);
        OffsetDateTime t = OffsetDateTime.now(ZoneOffset.UTC).minusSeconds(seconds).truncatedTo(ChronoUnit.SECONDS);
        return type.startsWith("timestamptz") ? t : LocalDateTime.from(t);
    }

    static Object futureTimestamp(GenContext ctx, String type, int maxDaysAhead) {
        long seconds = ctx.random.nextLong((long) maxDaysAhead * 24 * 3600);
        OffsetDateTime t = OffsetDateTime.now(ZoneOffset.UTC).plusSeconds(seconds).truncatedTo(ChronoUnit.SECONDS);
        return type.startsWith("timestamptz") ? t : LocalDateTime.from(t);
    }

    static BigDecimal decimal(GenContext ctx, int scale, long min, long max) {
        double v = min + ctx.random.nextDouble() * (max - min);
        return BigDecimal.valueOf(v).setScale(scale, RoundingMode.HALF_UP);
    }

    static boolean isTexty(String type) {
        return type.equals("varchar") || type.equals("text") || type.equals("bpchar")
                || type.equals("char") || type.equals("name") || type.equals("citext");
    }

    static boolean isIntegerish(String type) {
        return type.equals("int2") || type.equals("int4") || type.equals("int8")
                || type.equals("smallint") || type.equals("integer") || type.equals("bigint");
    }

    static boolean isDecimal(String type) {
        return type.equals("numeric") || type.equals("decimal")
                || type.equals("float4") || type.equals("float8")
                || type.equals("real") || type.equals("double precision") || type.equals("money");
    }

    static boolean isDateType(String type) {
        return type.equals("date");
    }

    static boolean isTimestampType(String type) {
        return type.startsWith("timestamp");
    }

    private static Match plain(Supplier<Object> s) {
        return new Match(s, false);
    }

    private static String capitalize(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
